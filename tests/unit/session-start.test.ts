import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { CHECKPOINT_FILE } from '../../.claude/hooks/lib/hook-utils.js';
import {
  buildDigest,
  DIGEST_LIMIT_BYTES,
  extractPosition,
  extractTopEntry,
  sessionStartOutput,
  truncateUtf8,
} from '../../.claude/hooks/session-start.js';

// Вывод скрипта: JSON с дайджестом в additionalContext.
const hookOutputSchema = z.object({
  hookSpecificOutput: z.object({
    hookEventName: z.literal('SessionStart'),
    additionalContext: z.string(),
  }),
});

const state = [
  '# Project State',
  '',
  '## Current Position',
  '',
  'Phase: 2 — Память агента',
  'Plan: без PLAN.md',
  'Status: In progress — MEM-01 выполнен',
  'Last activity: 2026-10-26',
  '',
  '## Session Continuity',
  '',
  'Last session: 2026-10-26',
  'Stopped at: MEM-01 закрыт',
  'Resume file: None',
  'Next: hook SessionStart',
].join('\n');

const memory = [
  '# Память проекта',
  '',
  'Новые записи — сверху.',
  '',
  '## 2026-10-26 — шаг 5',
  '',
  '**Сделано.** Hook SessionStart.',
  '',
  '## 2026-10-25 — шаг 4',
  '',
  '**Сделано.** Канарейка.',
].join('\n');

describe('extractPosition', () => {
  it('takes phase, status, stopped-at and next lines from STATE.md', () => {
    expect(extractPosition(state)).toBe(
      [
        'Phase: 2 — Память агента',
        'Status: In progress — MEM-01 выполнен',
        'Stopped at: MEM-01 закрыт',
        'Next: hook SessionStart',
      ].join('\n'),
    );
  });

  it('returns null when STATE.md has no position lines', () => {
    expect(extractPosition('# Project State\n\nнет позиции')).toBeNull();
  });
});

describe('extractTopEntry', () => {
  it('returns only the first entry of docs/memory.md', () => {
    expect(extractTopEntry(memory)).toBe(
      '## 2026-10-26 — шаг 5\n\n**Сделано.** Hook SessionStart.',
    );
  });

  it('returns the entry up to the end when it is the only one', () => {
    expect(extractTopEntry('# Память\n\n## Единственная\n\nтекст\n')).toBe(
      '## Единственная\n\nтекст',
    );
  });

  it('returns null when there are no entries', () => {
    expect(extractTopEntry('# Память проекта\n\nпусто')).toBeNull();
  });
});

describe('truncateUtf8', () => {
  it('keeps text that fits the limit unchanged', () => {
    expect(truncateUtf8('абв', 6)).toBe('абв');
  });

  it('cuts by bytes without breaking a multibyte character', () => {
    expect(truncateUtf8('абв', 5)).toBe('аб');
  });
});

describe('buildDigest', () => {
  it('includes branch, changed files, position and top memory entry', () => {
    const digest = buildDigest({
      branch: 'feat/module-2',
      changedFiles: 1,
      position: 'Phase: 2',
      checkpoint: null,
      memoryEntry: '## Шаг 5\n\nтекст',
    });
    expect(digest).toContain('Ветка: feat/module-2');
    expect(digest).toContain('Незакоммиченных файлов: 1');
    expect(digest).toContain('Phase: 2');
    expect(digest).toContain('## Шаг 5');
  });

  it('skips sections whose source is unavailable', () => {
    const digest = buildDigest({
      branch: null,
      changedFiles: null,
      position: null,
      checkpoint: null,
      memoryEntry: '## Шаг 5',
    });
    expect(digest).not.toContain('Ветка');
    expect(digest).not.toContain('Позиция GSD');
    expect(digest).toContain('## Шаг 5');
  });

  it('stays within the byte limit and marks the cut memory entry', () => {
    const digest = buildDigest({
      branch: 'feat/module-2',
      changedFiles: 0,
      position: 'Phase: 2',
      checkpoint: null,
      memoryEntry: `## Длинная запись\n\n${'я'.repeat(5000)}`,
    });
    expect(Buffer.byteLength(digest, 'utf8')).toBeLessThanOrEqual(DIGEST_LIMIT_BYTES);
    expect(digest).toContain('Phase: 2');
    expect(digest).toContain('обрезано');
  });

  it('puts checkpoint after compaction before memory entry', () => {
    const digest = buildDigest({
      branch: 'feat/module-2',
      changedFiles: 0,
      position: 'Phase: 2',
      checkpoint: 'Сжатие: manual',
      memoryEntry: '## Шаг 5',
    });
    expect(digest).toContain('Чек-пойнт перед сжатием');
    expect(digest.indexOf('Сжатие: manual')).toBeLessThan(digest.indexOf('## Шаг 5'));
  });

  it('stays within the byte limit with a large checkpoint', () => {
    const digest = buildDigest({
      branch: 'feat/module-2',
      changedFiles: 0,
      position: 'Phase: 2',
      checkpoint: 'ч'.repeat(3000),
      memoryEntry: '## Шаг 5',
    });
    expect(Buffer.byteLength(digest, 'utf8')).toBeLessThanOrEqual(DIGEST_LIMIT_BYTES);
    expect(digest).toContain('Phase: 2');
  });

  it('limits the digest to 3 KB', () => {
    expect(DIGEST_LIMIT_BYTES).toBe(3072);
  });
});

describe('sessionStartOutput', () => {
  it('wraps digest into SessionStart additionalContext', () => {
    expect(sessionStartOutput('дайджест')).toEqual({
      hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: 'дайджест' },
    });
  });
});

describe('session-start hook script', () => {
  const root = path.resolve(import.meta.dirname, '../..');
  const tsx = path.join(root, 'node_modules', '.bin', 'tsx');
  const script = path.join(root, '.claude', 'hooks', 'session-start.ts');
  let workDir: string | null = null;

  afterEach(() => {
    if (workDir) rmSync(workDir, { recursive: true, force: true });
    workDir = null;
  });

  // Временный проект вне git: ветка и счётчик файлов пропускаются, остальное читается из файлов.
  function makeProject(): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'session-start-'));
    mkdirSync(path.join(dir, '.planning'));
    writeFileSync(path.join(dir, '.planning', 'STATE.md'), state);
    mkdirSync(path.join(dir, 'docs'));
    writeFileSync(
      path.join(dir, 'docs', 'memory.md'),
      '# Память\n\n## Шаг 7\n\nСделано: команды.\n',
    );
    mkdirSync(path.join(dir, '.local', 'checkpoints'), { recursive: true });
    writeFileSync(path.join(dir, CHECKPOINT_FILE), 'Сжатие: manual\n');
    return dir;
  }

  function runHook(projectDir: string, stdin: string) {
    const result = spawnSync(tsx, [script], {
      input: stdin,
      timeout: 15000,
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
    });
    const output = result.status === 0 ? hookOutputSchema.parse(JSON.parse(result.stdout)) : null;
    return { status: result.status, context: output?.hookSpecificOutput.additionalContext ?? '' };
  }

  it('prints digest as SessionStart additionalContext on startup', () => {
    workDir = makeProject();
    const { status, context } = runHook(
      workDir,
      JSON.stringify({ source: 'startup', cwd: workDir }),
    );
    expect(status).toBe(0);
    expect(context).toContain('Phase: 2');
    expect(context).toContain('Сделано: команды.');
    expect(context).not.toContain('Сжатие: manual');
  });

  it('includes checkpoint only after compaction', () => {
    workDir = makeProject();
    const { status, context } = runHook(
      workDir,
      JSON.stringify({ source: 'compact', cwd: workDir }),
    );
    expect(status).toBe(0);
    expect(context).toContain('Сжатие: manual');
  });

  it('still prints digest with exit code 0 on malformed input', () => {
    workDir = makeProject();
    const { status, context } = runHook(workDir, 'не json');
    expect(status).toBe(0);
    expect(context).toContain('Phase: 2');
  });
});
