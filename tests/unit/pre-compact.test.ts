import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildCheckpoint, CHECKPOINT_FILE } from '../../.claude/hooks/pre-compact.js';

const now = new Date('2026-10-26T10:00:00.000Z');

const parts = {
  trigger: 'manual',
  now,
  branch: 'feat/module-2',
  status: ' M src/domain/loans.ts\n?? tests/unit/new.test.ts\n',
  commits: 'b0ce5ab docs: шаг 5\nb39d3e9 feat: hook SessionStart\n',
};

describe('buildCheckpoint', () => {
  it('records trigger, time, branch, changed files and commits', () => {
    const checkpoint = buildCheckpoint(parts);
    expect(checkpoint).toContain('Сжатие: manual, 2026-10-26T10:00:00.000Z');
    expect(checkpoint).toContain('Ветка: feat/module-2');
    expect(checkpoint).toContain('M src/domain/loans.ts');
    expect(checkpoint).toContain('b39d3e9 feat: hook SessionStart');
  });

  it('marks clean working tree', () => {
    expect(buildCheckpoint({ ...parts, status: '' })).toContain('Незакоммиченных изменений нет');
  });

  it('lists at most 20 changed files and counts the rest', () => {
    const status = Array.from({ length: 25 }, (_, index) => `?? file-${index}.ts`).join('\n');
    const checkpoint = buildCheckpoint({ ...parts, status });
    expect(checkpoint).toContain('file-19.ts');
    expect(checkpoint).not.toContain('file-20.ts');
    expect(checkpoint).toContain('…и ещё 5');
  });

  it('skips sections whose source is unavailable', () => {
    const checkpoint = buildCheckpoint({
      ...parts,
      branch: null,
      status: null,
      commits: null,
    });
    expect(checkpoint).toContain('Сжатие: manual');
    expect(checkpoint).not.toContain('Ветка');
    expect(checkpoint).not.toContain('Последние коммиты');
  });

  it('stores checkpoint in git-ignored .local directory', () => {
    expect(CHECKPOINT_FILE).toBe('.local/checkpoints/last.md');
  });
});

describe('pre-compact hook script', () => {
  const root = path.resolve(import.meta.dirname, '../..');
  const tsx = path.join(root, 'node_modules', '.bin', 'tsx');
  const script = path.join(root, '.claude', 'hooks', 'pre-compact.ts');
  let workDir: string | null = null;

  afterEach(() => {
    if (workDir) rmSync(workDir, { recursive: true, force: true });
    workDir = null;
  });

  function runHook(projectDir: string, stdin: string) {
    return spawnSync(tsx, [script], {
      input: stdin,
      timeout: 15000,
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
    });
  }

  it('writes checkpoint file into project directory', () => {
    workDir = mkdtempSync(path.join(tmpdir(), 'pre-compact-'));
    const result = runHook(workDir, JSON.stringify({ trigger: 'auto', cwd: workDir }));
    expect(result.status).toBe(0);
    const file = path.join(workDir, CHECKPOINT_FILE);
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, 'utf8')).toContain('Сжатие: auto');
  });

  it('exits with code 0 when checkpoint cannot be written', () => {
    workDir = mkdtempSync(path.join(tmpdir(), 'pre-compact-'));
    // Файл на месте каталога .local/ — mkdir чек-пойнта упадёт.
    writeFileSync(path.join(workDir, '.local'), '');
    const result = runHook(workDir, JSON.stringify({ trigger: 'manual', cwd: workDir }));
    expect(result.status).toBe(0);
    expect(result.stderr).toContain('чек-пойнт не записан');
  });

  it('exits with code 0 on malformed input', () => {
    workDir = mkdtempSync(path.join(tmpdir(), 'pre-compact-'));
    expect(runHook(workDir, 'не json').status).toBe(0);
  });
});
