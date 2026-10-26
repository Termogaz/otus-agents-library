// PreCompact: чек-пойнт перед сжатием — ветка, изменения, последние коммиты.
// Позицию GSD не дублирует: её даёт сам дайджест SessionStart.
// Контекст из PreCompact в сессию не попадает: файл читает SessionStart(compact).
// Код выхода всегда 0 — код 2 заблокировал бы сжатие.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isMain, readPreCompactInput } from './lib/hook-input.js';
import { attempt, CHECKPOINT_FILE, git, rootDir } from './lib/hook-utils.js';

export { CHECKPOINT_FILE };

const STATUS_LIMIT = 20;

export interface CheckpointParts {
  trigger: string;
  now: Date;
  branch: string | null;
  status: string | null;
  commits: string | null;
}

export function buildCheckpoint(parts: CheckpointParts): string {
  const head = [`Сжатие: ${parts.trigger}, ${parts.now.toISOString()}`];
  if (parts.branch !== null) head.push(`Ветка: ${parts.branch}`);
  const sections = [head.join('\n')];
  if (parts.status !== null) {
    const files = parts.status.split('\n').filter(Boolean);
    if (files.length === 0) {
      sections.push('Незакоммиченных изменений нет');
    } else {
      const listed = files.slice(0, STATUS_LIMIT);
      if (files.length > STATUS_LIMIT) listed.push(`…и ещё ${files.length - STATUS_LIMIT}`);
      sections.push(`Незакоммиченные файлы:\n${listed.join('\n')}`);
    }
  }
  if (parts.commits !== null) sections.push(`Последние коммиты:\n${parts.commits.trim()}`);
  return `${sections.join('\n\n')}\n`;
}

if (isMain(import.meta.url)) {
  try {
    const input = attempt(readPreCompactInput);
    const root = rootDir(input);
    const checkpoint = buildCheckpoint({
      trigger: input?.trigger ?? 'unknown',
      now: new Date(),
      branch: attempt(() => git(root, ['branch', '--show-current']).trim() || '(detached HEAD)'),
      status: attempt(() => git(root, ['status', '--short'])),
      commits: attempt(() => git(root, ['log', '--oneline', '-3'])),
    });
    const file = path.join(root, CHECKPOINT_FILE);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, checkpoint);
  } catch (error) {
    process.stderr.write(`PreCompact: чек-пойнт не записан: ${String(error)}\n`);
  }
  process.exit(0);
}
