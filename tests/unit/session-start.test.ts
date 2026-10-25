import { describe, expect, it } from 'vitest';
import {
  buildDigest,
  DIGEST_LIMIT_BYTES,
  extractPosition,
  extractTopEntry,
  sessionStartOutput,
  truncateUtf8,
} from '../../.claude/hooks/session-start.js';

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
      memoryEntry: `## Длинная запись\n\n${'я'.repeat(5000)}`,
    });
    expect(Buffer.byteLength(digest, 'utf8')).toBeLessThanOrEqual(DIGEST_LIMIT_BYTES);
    expect(digest).toContain('Phase: 2');
    expect(digest).toContain('обрезано');
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
