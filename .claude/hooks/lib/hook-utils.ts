// Общее для информационных hooks (SessionStart, PreCompact): ошибки не роняют hook.
import { execFileSync } from 'node:child_process';

// Чек-пойнт PreCompact; каталог .local/ в .gitignore.
export const CHECKPOINT_FILE = '.local/checkpoints/last.md';

// Пустой результат вместо исключения: раздел просто пропускается.
export function attempt<T>(read: () => T): T | null {
  try {
    return read();
  } catch {
    return null;
  }
}

export function git(root: string, args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' });
}

// Корень проекта, даже если вход hook'а не разобрался.
export function rootDir(input: { cwd: string } | null): string {
  return process.env.CLAUDE_PROJECT_DIR ?? input?.cwd ?? process.cwd();
}
