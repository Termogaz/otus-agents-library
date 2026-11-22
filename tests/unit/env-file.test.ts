import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadLocalEnv } from '../../src/server/env-file.js';

describe('loadLocalEnv', () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'library-envfile-'));
    // Имя не похоже на файл окружения, чтобы не задевать защиту секретов.
    file = join(dir, 'vars.txt');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('loads keys that are not set in the process', async () => {
    await writeFile(file, 'A=1\n');
    const target: NodeJS.ProcessEnv = {};

    loadLocalEnv(file, target);

    expect(target.A).toBe('1');
  });

  it('keeps values that are already set', async () => {
    await writeFile(file, 'B=file\n');
    const target: NodeJS.ProcessEnv = { B: 'keep' };

    loadLocalEnv(file, target);

    expect(target.B).toBe('keep');
  });

  it('does nothing when the file is missing', () => {
    const target: NodeJS.ProcessEnv = {};

    expect(loadLocalEnv(join(dir, 'missing.txt'), target)).toBe(0);
    expect(target).toEqual({});
  });

  it('returns how many keys were loaded', async () => {
    await writeFile(file, 'C=1\nD=2\nE=3\n');
    const target: NodeJS.ProcessEnv = { D: 'keep' };

    expect(loadLocalEnv(file, target)).toBe(2);
  });
});
