// PreToolUse (Bash) во frontmatter агента reviewer: только команды чтения и проверки.
import { exitWithFeedback, isMain, readHookInput } from './lib/hook-input.js';
import { parseShell } from './lib/shell.js';

const EXACT_COMMANDS = new Set([
  'npm run check',
  'env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY npm run test:e2e',
]);
const READ_PROGRAMS = new Set(['ls', 'cat', 'head', 'tail', 'wc']);
const GIT_READ_SUBCOMMANDS = new Set(['status', 'diff', 'log', 'show']);
const GIT_BRANCH_READ_FLAGS = new Set([
  '--show-current',
  '--list',
  '-a',
  '--all',
  '-r',
  '--remotes',
  '-v',
  '-vv',
]);
// Цепочки, перенаправления и подстановки: за ними может прятаться запись.
const SHELL_METACHARS = /[;&|<>`\n]|\$\(/;

function deny(command: string, why: string): string {
  return `reviewer работает только на чтение: \`${command}\` — ${why}`;
}

export function checkReviewerCommand(command: string): string | null {
  const trimmed = command.trim();
  if (EXACT_COMMANDS.has(trimmed)) return null;
  if (SHELL_METACHARS.test(trimmed)) return deny(trimmed, 'цепочки и перенаправления запрещены');

  const [segment] = parseShell(trimmed);
  const [program, subcommand, ...args] = segment?.words ?? [];
  if (program === undefined) return deny(trimmed, 'пустая команда');
  if (READ_PROGRAMS.has(program)) return null;

  if (program === 'git' && subcommand !== undefined) {
    if (GIT_READ_SUBCOMMANDS.has(subcommand)) {
      return args.some((a) => a.startsWith('--output'))
        ? deny(trimmed, '--output пишет в файл')
        : null;
    }
    if (subcommand === 'branch') {
      return args.every((a) => GIT_BRANCH_READ_FLAGS.has(a))
        ? null
        : deny(trimmed, 'разрешён только просмотр веток');
    }
  }
  return deny(trimmed, 'команды нет в белом списке');
}

if (isMain(import.meta.url)) {
  try {
    const reason = checkReviewerCommand(readHookInput().tool_input.command ?? '');
    if (reason) exitWithFeedback(reason);
  } catch (error) {
    exitWithFeedback(`reviewer-readonly: не удалось проверить вызов (${String(error)}).`);
  }
}
