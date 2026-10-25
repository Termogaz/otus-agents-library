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

// Вложенный shell: скрипт после `-c` разбирается рекурсивно, глубина ограничена.
const NESTED_SHELLS = new Set(['sh', 'bash', 'zsh', 'dash']);
const MAX_SHELL_DEPTH = 3;

// Fail-closed (CR-05): конструкции, которые эвристика не раскрывает. Если в такой команде
// встречается секретный токен .env*, она отклоняется целиком. Без токена — не трогаем.
const SHELL_NAME = '(?:sh|bash|zsh|dash)';
// Shell, которому скрипт идёт со stdin: `bash <<EOF`, `bash <<< "..."`, `sh -s < file`.
const SHELL_STDIN_FORM = new RegExp(
  `(?:^|[\\s;&|(){}])(?:\\S*/)?${SHELL_NAME}(?:\\s+-[^\\s<]+)*\\s*<`,
);
// Shell на конце канала: `echo '...' | bash`. `||` — не канал; `| bash script.sh` скрипт берёт из файла.
const PIPE_TO_SHELL = new RegExp(
  `(?<!\\|)\\|&?\\s*(?:sudo\\s+)?(?:\\S*/)?${SHELL_NAME}(?:\\s+-\\S+)*(?=\\s*(?:$|[;&|)<>}\\n]))`,
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

// Аргументы команды, которые она может прочитать как файлы.
function readOperands(program: string, args: string[]): string[] {
  // У grep-семейства значения `--regexp=` и `--file=` разобраны в searchOperands.
  if (PATTERN_SEARCH_PROGRAMS.has(program)) return searchOperands(args);
  return [...args.filter((a) => !a.startsWith('-')), ...optionValues(args)];
}

// Строка-скрипт вложенного shell: аргумент после `-c` или склеенного флага вроде `-lc`.
function nestedScript(args: string[]): string | undefined {
  const flagIndex = args.findIndex((a) => /^-[a-zA-Z]+$/.test(a) && a.endsWith('c'));
  return flagIndex === -1 ? undefined : args[flagIndex + 1];
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

// `git add` с форсом добавляет в индекс игнорируемые файлы, в том числе .env* (D-09).
function gitAddForceDecision(args: string[]): BashDecision | null {
  if (args[0] !== 'add') return null;
  const flags = args.slice(1).filter((a) => a.startsWith('-'));
  const paths = args.slice(1).filter((a) => !a.startsWith('-'));
  const hasShortFlag = (letter: string) =>
    flags.some((f) => /^-[a-zA-Z]+$/.test(f) && f.includes(letter));

  const forced = flags.includes('--force') || hasShortFlag('f');
  if (!forced) return null;

  const addsAll = flags.includes('--all') || hasShortFlag('A');
  // Широкий pathspec: форс подхватит и игнорируемый .env. Каталог без `/` не распознаётся.
  const isBroad = (p: string) =>
    p === '.' || p === './' || p.startsWith(':') || p.endsWith('/') || p.includes('*');
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
  for (const target of readTargets) {
    const decision = secretReadDecision(target);
    if (decision) return decision;
  }

  const [name, ...args] = words[0] === 'sudo' ? words.slice(1) : words;
  if (name === undefined) return ask;
  const program = path.posix.basename(name);
  const files = args.filter((a) => !a.startsWith('-'));

  let candidates: string[] = [];
  if (WRITES_ANY_ARG.has(program)) candidates = files;
  else if (WRITES_LAST_ARG.has(program)) candidates = files.slice(-1);
  else if (IN_PLACE_EDITORS.has(program) && args.some(isInPlaceFlag)) candidates = files;

  for (const file of candidates) {
    const reason = protectedReason(file);
    if (reason) return { decision: 'deny', reason };
    ask ??= agentConfigAsk(file);
  }

  if (program === 'git') {
    const decision = gitAddForceDecision(args);
    if (decision) return decision;
  }

  // Чтение: проверяем аргументы-пути, а не подстроку команды (D-05).
  if (!NON_READING_PROGRAMS.has(program)) {
    for (const operand of readOperands(program, args)) {
      const decision = secretReadDecision(operand);
      if (decision) return decision;
    }
  }

  // Вложенный shell: `bash -c "cat .env"` разбираем как отдельную команду.
  if (NESTED_SHELLS.has(program)) {
    const script = nestedScript(args);
    if (script !== undefined) {
      const nested = checkCommand(script, depth + 1);
      if (nested?.decision === 'deny') return nested;
      ask ??= nested;
    }
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
    const [name, ...args] = words[0] === 'sudo' ? words.slice(1) : words;
    if (name === undefined) continue;
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
  return command.split(/[\s;&|<>()]+/).some((piece) => {
    const bare = piece.replaceAll(/['"]/g, '').replace(/^\$/, '');
    if (bare === '') return false;
    return isSecretOperand(bare) || isSecretFileName(path.posix.basename(bare));
  });
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
