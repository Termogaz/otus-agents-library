// PreToolUse (Edit|Write|Bash): запрет записи в .env*, .git/ и package-lock.json.
import path from 'node:path';
import { exitWithFeedback, isMain, readHookInput } from './lib/hook-input.js';
import { parseShell } from './lib/shell.js';

// Команды, которые меняют любой файл из аргументов.
const WRITES_ANY_ARG = new Set(['rm', 'mv', 'tee', 'truncate', 'touch', 'chmod', 'chown']);
// Команды, которые пишут в последний аргумент.
const WRITES_LAST_ARG = new Set(['cp', 'ln', 'install', 'rsync']);
// Правка «на месте»: `sed -i`, `perl -pi`.
const IN_PLACE_EDITORS = new Set(['sed', 'perl']);

function protectedReason(file: string): string | null {
  const normalized = path.posix.normalize(file.replaceAll('\\', '/'));
  const base = path.posix.basename(normalized);
  if (base.startsWith('.env')) return `${file}: файлы .env* содержат секреты`;
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

export function checkBashCommand(command: string): string | null {
  for (const { words, writeTargets } of parseShell(command)) {
    for (const target of writeTargets) {
      const reason = protectedReason(target);
      if (reason) return reason;
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
      if (reason) return reason;
    }
  }
  return null;
}

if (isMain(import.meta.url)) {
  try {
    const { tool_name, tool_input } = readHookInput();
    const reason =
      tool_name === 'Bash'
        ? checkBashCommand(tool_input.command ?? '')
        : checkFilePath(tool_input.file_path ?? '');
    if (reason) exitWithFeedback(`Запись в защищённый файл заблокирована hook'ом: ${reason}.`);
  } catch (error) {
    // Не смогли разобрать вход — лучше запретить, чем пропустить запись.
    exitWithFeedback(`protect-files: не удалось проверить вызов (${String(error)}).`);
  }
}
