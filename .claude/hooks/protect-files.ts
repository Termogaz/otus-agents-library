// PreToolUse (Edit|Write|Bash): запрет записи в .env*, .git/ и package-lock.json,
// а для Bash — ещё и чтения секретных .env* через аргументы-пути команд.
import path from 'node:path';
import { exitWithAsk, exitWithFeedback, isMain, readHookInput } from './lib/hook-input.js';
import { isEnvFileName, isSecretFileName, isSecretOperand } from './lib/secret-names.js';
import { parseShell, type ShellSegment } from './lib/shell.js';

// Команды, которые меняют любой файл из аргументов.
const WRITES_ANY_ARG = new Set(['rm', 'mv', 'tee', 'truncate', 'touch', 'chmod', 'chown']);
// Команды, которые пишут в последний аргумент.
const WRITES_LAST_ARG = new Set(['cp', 'ln', 'install', 'rsync']);
// Правка «на месте»: `sed -i`, `perl -pi`.
const IN_PLACE_EDITORS = new Set(['sed', 'perl']);
// Команды, которые смотрят только имена и метаданные, но не содержимое файлов.
const NON_READING_PROGRAMS = new Set(['ls', 'test', '[', 'stat']);
// Поиск по шаблону: первый позиционный аргумент — шаблон, а не путь (D-05).
const PATTERN_SEARCH_PROGRAMS = new Set(['grep', 'egrep', 'fgrep', 'rg']);

// Команды, у которых есть `-t DIR` / `--target-directory=DIR`: запись идёт в каталог, а не в последний аргумент.
const TARGET_DIRECTORY_PROGRAMS = new Set(['cp', 'mv', 'install', 'ln']);

// Обёртки, запускающие следующее слово как команду (WR-01): значение — опции, которые берут
// отдельный аргумент (`env -u NAME`, `sudo -u user`). Опции без значения просто пропускаются.
// Опции, которые могут оказаться флагом без значения (`sudo -h`), сюда не входят: лишнее слово
// съело бы настоящую команду.
const WRAPPER_PROGRAMS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ['env', new Set(['-u', '--unset', '-C', '--chdir'])],
  [
    'sudo',
    new Set([
      '-u',
      '--user',
      '-g',
      '--group',
      '-p',
      '--prompt',
      '-C',
      '-D',
      '-r',
      '-t',
      '-T',
      '-U',
    ]),
  ],
  ['nice', new Set(['-n', '--adjustment'])],
  ['timeout', new Set(['-s', '--signal', '-k', '--kill-after'])],
  ['xargs', new Set(['-I', '-n', '-P', '-d', '-L', '-s', '-E', '-a', '--max-args', '--max-procs'])],
  ['time', new Set(['-f', '--format', '-o', '--output'])],
  ['exec', new Set(['-a'])],
  ['command', new Set<string>()],
  ['nohup', new Set<string>()],
  ['setsid', new Set<string>()],
  ['builtin', new Set<string>()],
  ['busybox', new Set<string>()],
]);
// Ключевые слова shell перед командой: `if rm x; then rm y; fi`, `! rm x`, `{ rm x; }`.
const SHELL_KEYWORDS = new Set(['if', 'elif', 'while', 'until', 'then', 'do', 'else', '!', '{']);
const ASSIGNMENT_WORD = /^[A-Za-z_][A-Za-z0-9_]*=/;

// Опции программ-писателей, значение которых — файл, куда идёт вывод (WR-01).
// `short` — буквы в кластере (`-sSo file`), `valueLetters` — буквы, после которых кластер кончается значением.
const OUTPUT_FILE_OPTIONS: ReadonlyMap<
  string,
  { short: string; valueLetters: string; long: readonly string[] }
> = new Map([
  [
    'curl',
    {
      short: 'oDc',
      valueLetters: 'AbcCdDeEFHKmoPQrtTuUwxXyYz',
      long: ['--output', '--dump-header', '--cookie-jar'],
    },
  ],
  [
    'wget',
    {
      short: 'Ooa',
      valueLetters: 'aoOetTwQPUiBlIARDX',
      long: ['--output-document', '--output-file', '--append-output'],
    },
  ],
]);

// Вложенный shell: скрипт после `-c` разбирается рекурсивно, глубина ограничена.
const NESTED_SHELLS = new Set([
  'sh',
  'bash',
  'zsh',
  'dash',
  'ksh',
  'mksh',
  'ash',
  'fish',
  'csh',
  'tcsh',
  'posh',
  'yash',
]);
// Опции shell, которые берут значение отдельным аргументом: `-o pipefail`, `--rcfile f`.
const SHELL_OPTIONS_WITH_VALUE = new Set(['-o', '+o', '-O', '+O', '--rcfile', '--init-file']);
// Действия `find`, после которых идёт команда до `;` или `+`.
const FIND_EXEC_ACTIONS = new Set(['-exec', '-execdir', '-ok', '-okdir']);
// Условия `find`, значение которых — имя или путь файла.
const FIND_NAME_TESTS = new Set(['-name', '-iname', '-path', '-ipath', '-wholename']);
// Подкоманды git, которые меняют или удаляют файлы рабочего дерева.
const GIT_WRITE_SUBCOMMANDS = new Set(['rm', 'mv', 'restore', 'checkout']);
const MAX_SHELL_DEPTH = 3;

// Fail-closed (CR-05): конструкции, которые эвристика не раскрывает. Если в такой команде
// встречается секретный токен .env*, она отклоняется целиком. Без токена — не трогаем.
const SHELL_NAME = '(?:sh|bash|zsh|dash|ksh|mksh|ash|fish|csh|tcsh|posh|yash)';
// Shell, которому скрипт идёт со stdin: `bash <<EOF`, `bash <<< "..."`, `sh -s < file`.
const SHELL_STDIN_FORM = new RegExp(
  `(?:^|[\\s;&|(){}])(?:\\S*/)?${SHELL_NAME}(?:\\s+-[^\\s<]+)*\\s*<`,
);
// Shell на конце канала: `echo '...' | bash`. `||` — не канал; `| bash script.sh` скрипт берёт из файла.
const PIPE_TO_SHELL = new RegExp(
  `(?<!\\|)\\|&?\\s*(?:sudo\\s+)?(?:busybox\\s+)?(?:\\S*/)?${SHELL_NAME}(?:\\s+-\\S+)*(?=\\s*(?:$|[;&|)<>}\\n]))`,
);
const EVAL_WORD = /(?:^|[\s;&|(){}])eval(?=[\s;&|()]|$)/;
// Интерпретаторы, которым скрипт передают флагом: `python3 -c`, `node -e`, `perl -e`.
const SCRIPT_INTERPRETERS = /^(?:python[\d.]*|node|ruby|perl)$/;
const SCRIPT_FLAG = /^(?:-[a-zA-Z]*[ceE]|--eval|--print)$/;

// Решение hook'а по Bash-команде: `deny` — отказ (код 2), `ask` — запрос подтверждения (код 0 и JSON).
export type BashDecision = { decision: 'deny' | 'ask'; reason: string };

function protectedReason(file: string): string | null {
  const normalized = path.posix.normalize(file.replaceAll('\\', '/'));
  const base = path.posix.basename(normalized);
  if (isEnvFileName(base)) return `${file}: файлы .env* содержат секреты`;
  if (base === 'package-lock.json')
    return `${file}: package-lock.json меняется только через npm, вручную нельзя`;
  if (normalized.split('/').includes('.git')) return `${file}: .git/ меняется только командами git`;
  return null;
}

export function checkFilePath(filePath: string): string | null {
  return protectedReason(filePath);
}

function isInPlaceFlag(arg: string): boolean {
  return arg === '--in-place' || arg.startsWith('--in-place=') || /^-[a-zA-Z]*i/.test(arg);
}

// Операнды grep-семейства, которые читаются как файлы. Шаблон — не путь:
// значения `-e`/`--regexp` и первый позиционный аргумент (если шаблон не задан опцией) пропускаются,
// значение `-f`/`--file` — файл шаблонов, это чтение. Значение другой опции отдельным аргументом
// (`-A 3`) не распознаётся: оно сойдёт за шаблон, ошибка возможна только в сторону лишнего отказа.
function searchOperands(args: string[]): string[] {
  const files: string[] = [];
  const positional: string[] = [];
  let patternByOption = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--regexp' || arg === '--file') {
      patternByOption = true;
      const value = args[++i];
      if (arg === '--file' && value !== undefined) files.push(value);
    } else if (arg.startsWith('--regexp=')) {
      patternByOption = true;
    } else if (arg.startsWith('--file=')) {
      patternByOption = true;
      files.push(arg.slice('--file='.length));
    } else if (arg.startsWith('--')) {
      // Прочие длинные флаги (`--include=*.ts`) путей не содержат.
    } else if (arg.startsWith('-') && arg.length > 1) {
      // Короткие флаги могут быть склеены: `-nie pattern`, `-fFILE`.
      for (let j = 1; j < arg.length; j++) {
        const flag = arg[j];
        if (flag !== 'e' && flag !== 'f') continue;
        patternByOption = true;
        const attached = arg.slice(j + 1);
        const value = attached === '' ? args[++i] : attached;
        if (flag === 'f' && value !== undefined) files.push(value);
        break;
      }
    } else {
      positional.push(arg);
    }
  }
  return [...files, ...(patternByOption ? positional : positional.slice(1))];
}

// Значения длинных опций вида `--file=.env`: часть после первого `=` может быть путём.
function optionValues(args: string[]): string[] {
  return args
    .filter((a) => a.startsWith('--') && a.includes('='))
    .map((a) => a.slice(a.indexOf('=') + 1))
    .filter((value) => value !== '');
}

// Значение, приклеенное к короткой опции: `curl -d@.env`, `awk -f.env`, `tar -T.env` (CR-03).
function attachedOptionValues(args: string[]): string[] {
  return args.filter((a) => /^-[A-Za-z]./.test(a)).map((a) => a.slice(2));
}

// Аргументы команды, которые она может прочитать как файлы.
function readOperands(program: string, args: string[]): string[] {
  // У grep-семейства значения `--regexp=` и `--file=` разобраны в searchOperands.
  if (PATTERN_SEARCH_PROGRAMS.has(program)) return searchOperands(args);
  return [
    ...args.filter((a) => !a.startsWith('-')),
    ...optionValues(args),
    ...attachedOptionValues(args),
  ];
}

// Флаг, который передаёт shell скрипт строкой: `-c`, `-lc`, `-ce` (CR-02).
function isCommandFlag(arg: string): boolean {
  return /^-[a-zA-Z]*c[a-zA-Z]*$/.test(arg) || arg === '--command' || arg.startsWith('--command=');
}

// Строка-скрипт вложенного shell по правилам bash (CR-02): опции идут до первого не-опции
// или `--`, флаг `-c` может стоять в любом кластере (`-ce`), скрипт — первый позиционный аргумент.
// У `fish` скрипт можно передать `--command`.
function nestedScript(args: string[]): string | undefined {
  let commandFlag = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--') return commandFlag ? args[i + 1] : undefined;
    if (arg === '--command') return args[i + 1];
    if (arg.startsWith('--command=')) return arg.slice('--command='.length);
    if (SHELL_OPTIONS_WITH_VALUE.has(arg)) {
      i++;
    } else if (/^[-+][a-zA-Z]+$/.test(arg)) {
      if (arg.startsWith('-') && arg.includes('c')) commandFlag = true;
    } else if (!arg.startsWith('--')) {
      return commandFlag ? arg : undefined;
    }
  }
  return undefined;
}

// Команда для `su -c 'cmd'` / `su --command=cmd`: значение идёт сразу за флагом, пользователь — где угодно.
function suScript(args: string[]): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg.startsWith('--command=')) return arg.slice('--command='.length);
    if (arg === '--command' || /^-[a-zA-Z]*c$/.test(arg)) return args[i + 1];
  }
  return undefined;
}

// Скрипт, который команда запустит во вложенном shell, или undefined.
function shellScriptOf(program: string, args: string[]): string | undefined {
  if (program === 'su') return suScript(args);
  return NESTED_SHELLS.has(program) ? nestedScript(args) : undefined;
}

// Команды после `find -exec … ;` / `-exec … +`: каждая — отдельная простая команда.
function findExecCommands(args: string[]): string[][] {
  const commands: string[][] = [];
  for (let i = 0; i < args.length; i++) {
    if (!FIND_EXEC_ACTIONS.has(args[i]!)) continue;
    const words: string[] = [];
    for (i++; i < args.length && args[i] !== ';' && args[i] !== '+'; i++) words.push(args[i]!);
    commands.push(words);
  }
  return commands;
}

// Имена и пути из условий `find`, когда находка будет удалена (`-delete`).
// Находку меняет `-delete` или писатель в `-exec` (`-exec rm {} \;`, `-exec sed -i … {} +`).
function findDeletedNames(args: string[]): string[] {
  const writesFound = findExecCommands(args).some(([name]) => {
    const program = path.posix.basename(name ?? '');
    return (
      WRITES_ANY_ARG.has(program) || WRITES_LAST_ARG.has(program) || IN_PLACE_EDITORS.has(program)
    );
  });
  if (!args.includes('-delete') && !writesFound) return [];
  return args.filter((_, i) => i > 0 && FIND_NAME_TESTS.has(args[i - 1]!));
}

// Файл аргументов `xargs -a FILE` / `--arg-file=FILE`: xargs читает его сам, а обёртка снимается раньше.
function xargsArgFiles(words: string[]): string[] {
  const start = words.findIndex((w) => path.posix.basename(w) === 'xargs');
  if (start === -1) return [];
  const files: string[] = [];
  for (let i = start + 1; i < words.length; i++) {
    const arg = words[i]!;
    if (arg === '-a' || arg === '--arg-file') {
      const value = words[++i];
      if (value !== undefined) files.push(value);
    } else if (arg.startsWith('--arg-file=')) files.push(arg.slice('--arg-file='.length));
    else if (/^-a./.test(arg)) files.push(arg.slice(2));
    else if (!arg.startsWith('-')) break;
  }
  return files;
}

// Путь указывает на корень проекта или выше: `.`, `./`, `..`, `../..`.
function isRootPath(operand: string): boolean {
  const normalized = path.posix.normalize(operand.replaceAll('\\', '/'));
  return normalized.split('/').every((part) => part === '' || part === '.' || part === '..');
}

// Рекурсивный поиск по корню может прочитать .env* без единого секретного аргумента (WR-04):
// `grep -r KEY .`; у `rg` скрытые файлы читаются только с `--hidden`/`-u`/`--no-ignore`.
// Явное исключение (`--exclude*`, у rg — `-g`/`--glob`) считаем безопасным: сужение задал автор команды.
function recursiveRootSearchAsk(program: string, args: string[]): BashDecision | null {
  if (!PATTERN_SEARCH_PROGRAMS.has(program)) return null;
  const isRipgrep = program === 'rg';
  let recursive = false;
  let readsHidden = false;
  let excluded = false;

  for (const arg of args) {
    if (arg === '--recursive' || arg === '--dereference-recursive') recursive = true;
    else if (arg === '--hidden' || arg === '--no-ignore') readsHidden = true;
    else if (arg.startsWith('--exclude')) excluded = true;
    else if (arg === '--glob' || arg.startsWith('--glob=') || arg.startsWith('--iglob')) {
      excluded = true;
    } else if (arg.startsWith('-') && !arg.startsWith('--') && arg.length > 1) {
      // Склеенные короткие флаги: `-rn`, `-uu`. После `-e`/`-f` идёт значение, а не флаги.
      for (const flag of arg.slice(1)) {
        if (flag === 'e' || flag === 'f') break;
        if (flag === 'g') {
          excluded = true;
          break;
        }
        if (flag === 'r' || flag === 'R') recursive = true;
        if (flag === 'u') readsHidden = true;
      }
    }
  }

  const reachesSecrets = isRipgrep ? readsHidden : recursive;
  if (!reachesSecrets || excluded) return null;
  const paths = searchOperands(args);
  if (paths.length > 0 && !paths.some(isRootPath)) return null;
  return {
    decision: 'ask',
    reason: 'рекурсивный grep по корню может прочитать .env*; сузьте путь или добавьте --exclude',
  };
}

// Операнд проверяется целиком и по частям после `=`, `@`, `:` (`if=.env`, `@.env`, `HEAD:.env`).
function secretReadDecision(operand: string): BashDecision | null {
  if (!isSecretOperand(operand)) return null;
  return {
    decision: 'deny',
    reason: `${operand}: чтение секретных файлов .env* запрещено (шаблоны .env.example, .env.sample, .env.template — можно)`,
  };
}

// Запись в конфигурацию агента (.claude/) не запрещена, но требует подтверждения (D-12).
function agentConfigAsk(file: string): BashDecision | null {
  const normalized = path.posix.normalize(file.replaceAll('\\', '/'));
  if (!normalized.split('/').includes('.claude')) return null;
  return {
    decision: 'ask',
    reason: `${file}: правка конфигурации агента в .claude/ требует подтверждения`,
  };
}

// Глобальные опции git, которые берут значение отдельным аргументом: `git -C . add`, `git -c k=v add`.
const GIT_GLOBAL_OPTIONS_WITH_VALUE = new Set([
  '-C',
  '-c',
  '--git-dir',
  '--work-tree',
  '--namespace',
  '--super-prefix',
  '--config-env',
]);

// Снимает глобальные опции git перед подкомандой (WR-03): `git -C . add -f .` — это тоже `add`.
function stripGitGlobalOptions(args: string[]): string[] {
  let i = 0;
  while (i < args.length && args[i]!.startsWith('-')) {
    i += GIT_GLOBAL_OPTIONS_WITH_VALUE.has(args[i]!) ? 2 : 1;
  }
  return args.slice(i);
}

// `git rm/mv/restore/checkout` по защищённому файлу меняет его в обход npm и hook'а записи.
function gitWriteDecision(rawArgs: string[]): BashDecision | null {
  const [subcommand, ...args] = stripGitGlobalOptions(rawArgs);
  if (subcommand === undefined || !GIT_WRITE_SUBCOMMANDS.has(subcommand)) return null;
  for (const arg of args) {
    if (arg.startsWith('-')) continue;
    const reason = protectedReason(arg);
    if (reason) return { decision: 'deny', reason };
  }
  return null;
}

// `git add` с форсом добавляет в индекс игнорируемые файлы, в том числе .env* (D-09).
function gitAddForceDecision(rawArgs: string[]): BashDecision | null {
  const args = stripGitGlobalOptions(rawArgs);
  if (args[0] !== 'add') return null;
  const flags = args.slice(1).filter((a) => a.startsWith('-'));
  const paths = args.slice(1).filter((a) => !a.startsWith('-'));
  const hasShortFlag = (letter: string) =>
    flags.some((f) => /^-[a-zA-Z]+$/.test(f) && f.includes(letter));

  // git принимает однозначный сокращённый длинный флаг: `--forc`, `--fo`.
  const isForceLong = (f: string) => f.length >= '--fo'.length && '--force'.startsWith(f);
  const forced = flags.some(isForceLong) || hasShortFlag('f');
  if (!forced) return null;

  const addsAll = flags.includes('--all') || hasShortFlag('A');
  // Широкий pathspec: форс подхватит и игнорируемый секрет. Это корень проекта и выше (`.`, `..`),
  // маска, каталог с `/` и путь, не похожий на файл (в имени нет точки): `src`, `config`.
  // Каталог с точкой в имени (`my.dir`) эвристика принимает за файл.
  const isBroad = (p: string) =>
    isRootPath(p) ||
    p.startsWith(':') ||
    p.endsWith('/') ||
    p.includes('*') ||
    !path.posix.basename(p.replaceAll('\\', '/')).includes('.');
  const isRisky =
    addsAll ||
    paths.length === 0 ||
    paths.some((p) => isBroad(p) || isEnvFileName(path.posix.basename(p.replaceAll('\\', '/'))));
  if (!isRisky) return null;
  return {
    decision: 'deny',
    reason: 'git add --force может закоммитить игнорируемые секреты .env*',
  };
}

// Снимает с начала простой команды всё, что не является настоящей программой (WR-01):
// присваивания `NAME=value`, ключевые слова `then`/`do`/`!`/`{`, обёртки `env`/`nohup`/`xargs`/`sudo`
// с их опциями. Результат — программа и её аргументы; пустой массив, если команды нет (`X=1`).
function stripCommandPrefixes(words: string[]): string[] {
  let rest = words;
  // Каждый проход укорачивает `rest`, поэтому цикл конечен.
  for (;;) {
    const [first, ...tail] = rest;
    if (first === undefined) return rest;
    if (SHELL_KEYWORDS.has(first) || ASSIGNMENT_WORD.test(first)) {
      rest = tail;
      continue;
    }
    const wrapper = path.posix.basename(first);
    const valueOptions = WRAPPER_PROGRAMS.get(wrapper);
    if (valueOptions === undefined) return rest;
    rest = skipWrapperOptions(wrapper, tail, valueOptions);
  }
}

function skipWrapperOptions(
  wrapper: string,
  args: string[],
  valueOptions: ReadonlySet<string>,
): string[] {
  let i = 0;
  while (i < args.length) {
    const arg = args[i]!;
    if (arg === '--') {
      i++;
      break;
    }
    if (wrapper === 'env' && (arg === '-S' || arg === '--split-string')) {
      // `env -S 'rm x'`: строка после опции — это сама команда со словами.
      const script = args[i + 1] ?? '';
      return [...script.split(/\s+/).filter((w) => w !== ''), ...args.slice(i + 2)];
    }
    if (!arg.startsWith('-') || arg === '-') break;
    i += valueOptions.has(arg) ? 2 : 1;
  }
  const rest = args.slice(i);
  // `timeout 5 cmd`: первое слово после опций — длительность, а не команда.
  return wrapper === 'timeout' ? rest.slice(1) : rest;
}

// Каталог из `-t DIR`, `-tDIR`, `-rt DIR` или `--target-directory[=]DIR`, либо undefined.
function targetDirectory(args: string[]): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--') return undefined;
    if (arg === '--target-directory') return args[i + 1];
    if (arg.startsWith('--target-directory=')) return arg.slice('--target-directory='.length);
    const cluster = /^-([a-zA-Z]*)t(.*)$/.exec(arg);
    if (cluster && !arg.startsWith('--')) return cluster[2] === '' ? args[i + 1] : cluster[2];
  }
  return undefined;
}

// Файлы, в которые пишут dd (`of=`), curl и wget (`-o`/`-O`/`--output`) — не последний аргумент (WR-01).
function outputFileTargets(program: string, args: string[]): string[] {
  if (program === 'dd') {
    return args.filter((a) => a.startsWith('of=')).map((a) => a.slice('of='.length));
  }
  const options = OUTPUT_FILE_OPTIONS.get(program);
  if (options === undefined) return [];

  const targets: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      const name = eq === -1 ? arg : arg.slice(0, eq);
      if (!options.long.includes(name)) continue;
      const value = eq === -1 ? args[++i] : arg.slice(eq + 1);
      if (value !== undefined) targets.push(value);
    } else if (arg.startsWith('-') && arg.length > 1) {
      // Кластер `-sSo file`: до первой буквы, берущей значение, остальное — флаги.
      for (let j = 1; j < arg.length; j++) {
        const letter = arg[j]!;
        if (!options.valueLetters.includes(letter)) continue;
        const attached = arg.slice(j + 1);
        const value = attached === '' ? args[++i] : attached;
        if (options.short.includes(letter) && value !== undefined) targets.push(value);
        break;
      }
    }
  }
  return targets;
}

function checkSegment(segment: ShellSegment, depth: number): BashDecision | null {
  const { words, writeTargets, readTargets } = segment;
  // `ask` не прерывает проверку: отказ по секрету в той же команде приоритетнее (D-12).
  let ask: BashDecision | null = null;

  for (const target of writeTargets) {
    const reason = protectedReason(target);
    if (reason) return { decision: 'deny', reason };
    ask ??= agentConfigAsk(target);
  }

  // Цель `<`: shell открывает файл сам, поэтому проверяем её независимо от команды.
  for (const target of [...readTargets, ...xargsArgFiles(words)]) {
    const decision = secretReadDecision(target);
    if (decision) return decision;
  }

  const [name, ...args] = stripCommandPrefixes(words);
  if (name === undefined) return ask;
  const program = path.posix.basename(name);
  const files = args.filter((a) => !a.startsWith('-'));
  const targetDir = TARGET_DIRECTORY_PROGRAMS.has(program) ? targetDirectory(args) : undefined;

  let candidates: string[];
  if (WRITES_ANY_ARG.has(program)) {
    // `mv -t DIR a`: каталог из `--target-directory=DIR` не попал бы в `files`.
    candidates = targetDir === undefined ? files : [...files, targetDir];
  } else if (WRITES_LAST_ARG.has(program)) {
    candidates = targetDir === undefined ? files.slice(-1) : [targetDir];
  } else if (IN_PLACE_EDITORS.has(program) && args.some(isInPlaceFlag)) candidates = files;
  else if (program === 'find') candidates = findDeletedNames(args);
  else candidates = outputFileTargets(program, args);

  for (const file of candidates) {
    const reason = protectedReason(file);
    if (reason) return { decision: 'deny', reason };
    ask ??= agentConfigAsk(file);
  }

  if (program === 'git') {
    const decision = gitAddForceDecision(args) ?? gitWriteDecision(args);
    if (decision) return decision;
  }

  // `find -exec cmd … ;`: каждую команду проверяем как отдельный сегмент.
  if (program === 'find') {
    for (const execWords of findExecCommands(args)) {
      const decision = checkSegment({ words: execWords, writeTargets: [], readTargets: [] }, depth);
      if (decision?.decision === 'deny') return decision;
      ask ??= decision;
    }
  }

  // Чтение: проверяем аргументы-пути, а не подстроку команды (D-05).
  if (!NON_READING_PROGRAMS.has(program)) {
    for (const operand of readOperands(program, args)) {
      const decision = secretReadDecision(operand);
      if (decision) return decision;
    }
  }

  ask ??= recursiveRootSearchAsk(program, args);

  // Вложенный shell: `bash -c "cat .env"`, `su -c '…'` разбираем как отдельную команду.
  const script = shellScriptOf(program, args);
  if (script !== undefined) {
    const nested = checkCommand(script, depth + 1);
    if (nested?.decision === 'deny') return nested;
    ask ??= nested;
  }
  return ask;
}

// Причина, по которой команду нельзя разобрать эвристикой, либо null.
function unmodellableReason(command: string): string | null {
  if (/\$\(|`/.test(command)) return 'подстановка команды';
  if (/\$[A-Za-z_{]/.test(command)) return 'подстановка переменной';
  if (EVAL_WORD.test(command)) return 'eval';
  if (SHELL_STDIN_FORM.test(command) || PIPE_TO_SHELL.test(command)) {
    return 'shell получает скрипт со stdin';
  }
  for (const { words } of parseShell(command)) {
    const [name, ...args] = stripCommandPrefixes(words);
    if (name === undefined) continue;
    const program = path.posix.basename(name);
    if (
      (NESTED_SHELLS.has(program) || program === 'su') &&
      args.some(isCommandFlag) &&
      shellScriptOf(program, args) === undefined
    ) {
      return 'вложенный shell, скрипт которого не определён';
    }
    if (
      SCRIPT_INTERPRETERS.test(path.posix.basename(name)) &&
      args.some((a) => SCRIPT_FLAG.test(a))
    ) {
      return 'интерпретатор со скриптом в аргументе';
    }
  }
  return null;
}

// Есть ли в сыром тексте команды секретный токен .env*. Не зависит от токенизатора:
// режет по пробелам и операторам, снимает кавычки и смотрит каждый кусок.
function mentionsSecretToken(command: string): boolean {
  const byPieces = command.split(/[\s;&|<>()`]+/).some((piece) => {
    const bare = piece.replaceAll(/['"]/g, '').replace(/^\$/, '');
    if (bare === '') return false;
    return isSecretOperand(bare) || isSecretFileName(path.posix.basename(bare));
  });
  if (byPieces) return true;
  // Имя внутри конструкций вроде `${F:-.env}`: ищем `.env…` в тексте, не продолжающее другое слово.
  return [...command.matchAll(/\.env[A-Za-z0-9_.\-*?~]*/g)].some(
    (match) => !/[A-Za-z0-9_]/.test(command[match.index - 1] ?? '') && isSecretFileName(match[0]),
  );
}

// Защищённые от записи файлы в тексте команды: `package-lock.json`, `.git/`, `.claude/` (WR-01).
const PROTECTED_TOKEN =
  /(?:^|[^\w.-])(?:package-lock\.json|\.git\/|\.git(?=[\s'"`;&|<>(){}]|$)|\.claude\/)/;
// Признаки записи: программы-писатели, функции удаления и записи в скриптах, `>` не в /dev/null и не дубль дескриптора.
const WRITE_HINT =
  /(?:^|[^\w-])(?:rm|mv|cp|tee|truncate|touch|chmod|chown|install|ln|rsync|dd|unlink|remove|rename|rmSync|unlinkSync|writeFile\w*)(?![\w-])|>(?!&|>?\s*\/dev\/null)/;

// Немоделируемая конструкция может изменить защищённый файл: в тексте есть и его имя, и признак записи.
function mentionsProtectedWrite(command: string): boolean {
  return PROTECTED_TOKEN.test(command) && WRITE_HINT.test(command);
}

// Итог по всей команде: любой `deny` побеждает, затем fail-closed `deny`, иначе первый `ask`, иначе null.
function checkCommand(command: string, depth: number): BashDecision | null {
  if (depth > MAX_SHELL_DEPTH) {
    return { decision: 'deny', reason: 'слишком глубокая вложенность shell, команду не проверить' };
  }
  let firstAsk: BashDecision | null = null;
  for (const segment of parseShell(command)) {
    const decision = checkSegment(segment, depth);
    if (decision?.decision === 'deny') return decision;
    if (decision && !firstAsk) firstAsk = decision;
  }
  // Вложенный скрипт целиком входит в исходную команду, поэтому достаточно проверить верхний уровень.
  if (depth === 0) {
    const reason = unmodellableReason(command);
    if (reason !== null && mentionsSecretToken(command)) {
      return {
        decision: 'deny',
        reason: `команда использует конструкцию, которую hook не разбирает (${reason}), и упоминает секрет .env* — отказ (fail-closed)`,
      };
    }
    if (reason !== null && firstAsk === null && mentionsProtectedWrite(command)) {
      return {
        decision: 'ask',
        reason: `команда использует конструкцию, которую hook не разбирает (${reason}), и может изменить package-lock.json, .git/ или .claude/ — нужно подтверждение`,
      };
    }
  }
  return firstAsk;
}

export function checkBashDecision(command: string): BashDecision | null {
  return checkCommand(command, 0);
}

// Контракт сохранён: причина отказа или null.
export function checkBashCommand(command: string): string | null {
  const result = checkBashDecision(command);
  return result?.decision === 'deny' ? result.reason : null;
}

if (isMain(import.meta.url)) {
  try {
    const { tool_name, tool_input } = readHookInput();
    if (tool_name === 'Bash') {
      const result = checkBashDecision(tool_input.command ?? '');
      if (result?.decision === 'deny') {
        exitWithFeedback(`protect-files: команда отклонена — ${result.reason}.`);
      }
      if (result?.decision === 'ask') exitWithAsk(`protect-files: ${result.reason}.`);
    } else {
      const reason = checkFilePath(tool_input.file_path ?? '');
      if (reason) exitWithFeedback(`Запись в защищённый файл заблокирована hook'ом: ${reason}.`);
    }
  } catch (error) {
    // Не смогли разобрать вход — лучше запретить, чем пропустить запись.
    exitWithFeedback(`protect-files: не удалось проверить вызов (${String(error)}).`);
  }
}
