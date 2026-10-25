// SessionStart: дайджест для новой сессии — ветка, позиция GSD, верхняя запись docs/memory.md;
// после сжатия (source=compact) — ещё чек-пойнт PreCompact.
// Hook информационный: любая ошибка пропускает раздел, код выхода всегда 0.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isMain, readSessionStartInput } from './lib/hook-input.js';
import { attempt, CHECKPOINT_FILE, git, rootDir } from './lib/hook-utils.js';

export const DIGEST_LIMIT_BYTES = 3072;

const POSITION_PREFIXES = ['Phase:', 'Status:', 'Stopped at:', 'Next:'];

export interface DigestParts {
  branch: string | null;
  changedFiles: number | null;
  position: string | null;
  checkpoint: string | null;
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

const bytes = (text: string) => Buffer.byteLength(text, 'utf8');

// Обрезает текст до maxBytes байт UTF-8, не разрывая многобайтовый символ.
export function truncateUtf8(text: string, maxBytes: number): string {
  if (bytes(text) <= maxBytes) return text;
  let result = '';
  let size = 0;
  for (const char of text) {
    const charSize = bytes(char);
    if (size + charSize > maxBytes) break;
    result += char;
    size += charSize;
  }
  return result;
}

// Дописывает раздел в остаток бюджета; не влезающий раздел обрезается с пометкой.
function appendSection(digest: string, title: string, body: string, source: string): string {
  const prefix = `${digest}\n\n${title}`;
  const cutMark = `\n…(обрезано, полностью — ${source})`;
  const budget = DIGEST_LIMIT_BYTES - bytes(prefix);
  if (bytes(body) <= budget) return prefix + body;
  if (budget <= bytes(cutMark)) return digest;
  return prefix + truncateUtf8(body, budget - bytes(cutMark)) + cutMark;
}

// Разделы — по убыванию важности: следующий получает то, что осталось от предыдущих.
export function buildDigest(parts: DigestParts): string {
  let digest = '# Дайджест сессии (hook SessionStart)';
  const git: string[] = [];
  if (parts.branch !== null) git.push(`Ветка: ${parts.branch}`);
  if (parts.changedFiles !== null) git.push(`Незакоммиченных файлов: ${parts.changedFiles}`);
  if (git.length > 0) digest = appendSection(digest, '', git.join('\n'), 'git status');
  if (parts.position !== null) {
    digest = appendSection(
      digest,
      'Позиция GSD (.planning/STATE.md):\n',
      parts.position,
      '.planning/STATE.md',
    );
  }
  if (parts.checkpoint !== null) {
    digest = appendSection(
      digest,
      `Чек-пойнт перед сжатием (${CHECKPOINT_FILE}):\n`,
      parts.checkpoint,
      CHECKPOINT_FILE,
    );
  }
  if (parts.memoryEntry !== null) {
    digest = appendSection(
      digest,
      'Верхняя запись docs/memory.md:\n',
      parts.memoryEntry,
      'docs/memory.md',
    );
  }
  return digest;
}

export function sessionStartOutput(digest: string) {
  return { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: digest } };
}

if (isMain(import.meta.url)) {
  const input = attempt(readSessionStartInput);
  const root = rootDir(input);
  const readText = (file: string) => readFileSync(path.join(root, file), 'utf8');
  const digest = buildDigest({
    branch: attempt(() => git(root, ['branch', '--show-current']).trim() || '(detached HEAD)'),
    changedFiles: attempt(
      () => git(root, ['status', '--porcelain']).split('\n').filter(Boolean).length,
    ),
    position: attempt(() => extractPosition(readText('.planning/STATE.md'))),
    checkpoint:
      input?.source === 'compact' ? attempt(() => readText(CHECKPOINT_FILE).trim()) : null,
    memoryEntry: attempt(() => extractTopEntry(readText('docs/memory.md'))),
  });
  process.stdout.write(`${JSON.stringify(sessionStartOutput(digest))}\n`);
}
