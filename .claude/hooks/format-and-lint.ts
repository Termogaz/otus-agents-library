// PostToolUse (Edit|Write): Prettier и ESLint для изменённого файла; ошибки ESLint — агенту.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { exitWithFeedback, isMain, projectDir, readHookInput } from './lib/hook-input.js';

const LINTED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);

export interface Checks {
  format: boolean;
  lint: boolean;
}

export function planChecks(filePath: string, root: string): Checks {
  const relative = path.relative(root, filePath);
  const outside =
    relative.startsWith('..') ||
    path.isAbsolute(relative) ||
    relative.split(path.sep)[0] === 'node_modules';
  if (outside) return { format: false, lint: false };
  return { format: true, lint: LINTED_EXTENSIONS.has(path.extname(filePath)) };
}

// Запускает инструмент из node_modules/.bin; возвращает текст ошибки или null.
function run(root: string, tool: string, args: string[]): string | null {
  try {
    execFileSync(path.join(root, 'node_modules', '.bin', tool), args, {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return null;
  } catch (error) {
    const { stdout, stderr } = error as { stdout?: string; stderr?: string };
    return `${stdout ?? ''}${stderr ?? ''}`.trim() || String(error);
  }
}

if (isMain(import.meta.url)) {
  const input = readHookInput();
  const root = projectDir(input);
  const file = input.tool_input.file_path;
  if (file !== undefined) {
    const checks = planChecks(file, root);
    const problems: string[] = [];
    if (checks.format) {
      const error = run(root, 'prettier', ['--write', '--ignore-unknown', file]);
      if (error) problems.push(`Prettier:\n${error}`);
    }
    if (checks.lint) {
      const error = run(root, 'eslint', ['--no-warn-ignored', file]);
      if (error) problems.push(`ESLint:\n${error}`);
    }
    if (problems.length > 0) {
      exitWithFeedback(
        `Проверка после правки ${file} не прошла — исправь:\n${problems.join('\n\n')}`,
      );
    }
  }
}
