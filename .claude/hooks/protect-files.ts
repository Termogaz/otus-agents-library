// PreToolUse (Edit|Write|Bash): запрет записи в .env*, .git/ и package-lock.json,
// а для Bash — ещё и чтения секретных .env* через аргументы-пути команд.
import path from 'node:path';
import { exitWithFeedback, isMain, readHookInput } from './lib/hook-input.js';
import { isEnvFileName, isSecretPath } from './lib/secret-names.js';
import { parseShell } from './lib/shell.js';

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

// Решение hook'а по Bash-команде: `deny` — отказ (код 2); `ask` выдаёт план 01-05.
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

// Аргументы команды, которые она может прочитать как файлы.
function readOperands(program: string, args: string[]): string[] {
  if (PATTERN_SEARCH_PROGRAMS.has(program)) return searchOperands(args);
  return args.filter((a) => !a.startsWith('-'));
}

export function checkBashDecision(command: string): BashDecision | null {
  for (const { words, writeTargets } of parseShell(command)) {
    for (const target of writeTargets) {
      const reason = protectedReason(target);
      if (reason) return { decision: 'deny', reason };
    }

    const [name, ...args] = words[0] === 'sudo' ? words.slice(1) : words;
    if (name === undefined) continue;
    const program = path.posix.basename(name);
    const files = args.filter((a) => !a.startsWith('-'));

    let candidates: string[] = [];
    if (WRITES_ANY_ARG.has(program)) candidates = files;
    else if (WRITES_LAST_ARG.has(program)) candidates = files.slice(-1);
    else if (IN_PLACE_EDITORS.has(program) && args.some(isInPlaceFlag)) candidates = files;

    for (const file of candidates) {
      const reason = protectedReason(file);
      if (reason) return { decision: 'deny', reason };
    }

    // Чтение: проверяем аргументы-пути, а не подстроку команды (D-05).
    if (NON_READING_PROGRAMS.has(program)) continue;
    for (const operand of readOperands(program, args)) {
      if (isSecretPath(operand)) {
        return {
          decision: 'deny',
          reason: `${operand}: чтение секретных файлов .env* запрещено (шаблоны .env.example, .env.sample, .env.template — можно)`,
        };
      }
    }
  }
  return null;
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
    } else {
      const reason = checkFilePath(tool_input.file_path ?? '');
      if (reason) exitWithFeedback(`Запись в защищённый файл заблокирована hook'ом: ${reason}.`);
    }
  } catch (error) {
    // Не смогли разобрать вход — лучше запретить, чем пропустить запись.
    exitWithFeedback(`protect-files: не удалось проверить вызов (${String(error)}).`);
  }
}
