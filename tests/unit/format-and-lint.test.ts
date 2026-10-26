import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { planChecks } from '../../.claude/hooks/format-and-lint.js';

const root = '/home/user/library';

describe('planChecks', () => {
  it('formats and lints TypeScript file inside project', () => {
    expect(planChecks(`${root}/src/domain/loan.ts`, root)).toEqual({ format: true, lint: true });
  });

  it('formats and lints React component', () => {
    expect(planChecks(`${root}/src/client/App.tsx`, root)).toEqual({ format: true, lint: true });
  });

  it.each(['docs/plan.md', 'package.json', '.claude/settings.json'])(
    'formats but does not lint non-code file %s',
    (file) => {
      expect(planChecks(`${root}/${file}`, root)).toEqual({ format: true, lint: false });
    },
  );

  it.each(['/tmp/scratch.ts', '/home/user/library-other/a.ts', `${root}/node_modules/x/index.ts`])(
    'skips file outside project sources: %s',
    (file) => {
      expect(planChecks(file, root)).toEqual({ format: false, lint: false });
    },
  );
});

describe('format-and-lint hook script', () => {
  const root = path.resolve(import.meta.dirname, '../..');
  const tsx = path.join(root, 'node_modules', '.bin', 'tsx');
  const script = path.join(root, '.claude', 'hooks', 'format-and-lint.ts');
  let workDir: string | null = null;

  afterEach(() => {
    if (workDir) rmSync(workDir, { recursive: true, force: true });
    workDir = null;
  });

  // Временный проект со ссылкой на node_modules репозитория: hook берёт prettier оттуда.
  function makeProject(): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'format-and-lint-'));
    symlinkSync(path.join(root, 'node_modules'), path.join(dir, 'node_modules'));
    return dir;
  }

  function runHook(projectDir: string, filePath: string) {
    const stdin = JSON.stringify({
      tool_name: 'Write',
      tool_input: { file_path: filePath },
      cwd: projectDir,
    });
    return spawnSync(tsx, [script], {
      input: stdin,
      timeout: 30000,
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
    });
  }

  it('formats edited file in place with exit code 0', () => {
    workDir = makeProject();
    const file = path.join(workDir, 'data.json');
    writeFileSync(file, '{"a":1,"b":[1,2]}');
    const result = runHook(workDir, file);
    expect(result.status).toBe(0);
    expect(readFileSync(file, 'utf8')).toBe('{ "a": 1, "b": [1, 2] }\n');
  });

  it('leaves file outside project untouched', () => {
    workDir = makeProject();
    const outside = mkdtempSync(path.join(tmpdir(), 'format-and-lint-outside-'));
    const file = path.join(outside, 'data.json');
    writeFileSync(file, '{"a":1}');
    try {
      expect(runHook(workDir, file).status).toBe(0);
      expect(readFileSync(file, 'utf8')).toBe('{"a":1}');
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });
});
