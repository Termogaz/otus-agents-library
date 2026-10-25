// SessionStart: дайджест для новой сессии — ветка, позиция GSD, верхняя запись docs/memory.md.
// Hook информационный: любая ошибка пропускает раздел, код выхода всегда 0.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isMain, projectDir, readSessionStartInput } from './lib/hook-input.js';

export const DIGEST_LIMIT_BYTES = 3072;

const POSITION_PREFIXES = ['Phase:', 'Status:', 'Stopped at:', 'Next:'];
const CUT_MARK = '\n…(обрезано, полностью — docs/memory.md)';

export interface DigestParts {
  branch: string | null;
  changedFiles: number | null;
  position: string | null;
  memoryEntry: string | null;
}

// Строки позиции из .planning/STATE.md; null, если их нет.
export function extractPosition(state: string): string | null {
  const lines = state
    .split('\n')
    .filter((line) => POSITION_PREFIXES.some((prefix) => line.startsWith(prefix)));
  return lines.length > 0 ? lines.join('\n') : null;
}

// Первая запись `## …` журнала docs/memory.md (новые записи — сверху).
export function extractTopEntry(memory: string): string | null {
  const lines = memory.split('\n');
  const start = lines.findIndex((line) => line.startsWith('## '));
  if (start === -1) return null;
  const next = lines.findIndex((line, index) => index > start && line.startsWith('## '));
  const end = next === -1 ? lines.length : next;
  return lines.slice(start, end).join('\n').trim();
}

// Обрезает текст до maxBytes байт UTF-8, не разрывая многобайтовый символ.
export function truncateUtf8(text: string, maxBytes: number): string {
  if (Buffer.byteLength(text, 'utf8') <= maxBytes) return text;
  let result = '';
  let bytes = 0;
  for (const char of text) {
    const size = Buffer.byteLength(char, 'utf8');
    if (bytes + size > maxBytes) break;
    result += char;
    bytes += size;
  }
  return result;
}

export function buildDigest(parts: DigestParts): string {
  const sections = ['# Дайджест сессии (hook SessionStart)'];
  const git: string[] = [];
  if (parts.branch !== null) git.push(`Ветка: ${parts.branch}`);
  if (parts.changedFiles !== null) git.push(`Незакоммиченных файлов: ${parts.changedFiles}`);
  if (git.length > 0) sections.push(git.join('\n'));
  if (parts.position !== null) {
    sections.push(`Позиция GSD (.planning/STATE.md):\n${parts.position}`);
  }
  const head = sections.join('\n\n');
  if (parts.memoryEntry === null) return truncateUtf8(head, DIGEST_LIMIT_BYTES);

  // Бюджет сверх заголовка и позиции целиком отдаём записи журнала.
  const title = '\n\nВерхняя запись docs/memory.md:\n';
  const budget = DIGEST_LIMIT_BYTES - Buffer.byteLength(head + title, 'utf8');
  const entry =
    Buffer.byteLength(parts.memoryEntry, 'utf8') <= budget
      ? parts.memoryEntry
      : truncateUtf8(parts.memoryEntry, budget - Buffer.byteLength(CUT_MARK, 'utf8')) + CUT_MARK;
  return truncateUtf8(head + title + entry, DIGEST_LIMIT_BYTES);
}

export function sessionStartOutput(digest: string) {
  return { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: digest } };
}

// Пустой результат вместо исключения: раздел дайджеста просто пропускается.
function attempt<T>(read: () => T): T | null {
  try {
    return read();
  } catch {
    return null;
  }
}

function git(root: string, args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' });
}

if (isMain(import.meta.url)) {
  const input = attempt(readSessionStartInput);
  const root = input ? projectDir(input) : (process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
  const readText = (file: string) => readFileSync(path.join(root, file), 'utf8');
  const digest = buildDigest({
    branch: attempt(() => git(root, ['branch', '--show-current']).trim() || '(detached HEAD)'),
    changedFiles: attempt(
      () => git(root, ['status', '--porcelain']).split('\n').filter(Boolean).length,
    ),
    position: attempt(() => extractPosition(readText('.planning/STATE.md'))),
    memoryEntry: attempt(() => extractTopEntry(readText('docs/memory.md'))),
  });
  process.stdout.write(`${JSON.stringify(sessionStartOutput(digest))}\n`);
}
