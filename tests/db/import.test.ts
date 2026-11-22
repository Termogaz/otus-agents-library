import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { importJsonFile } from '../../src/server/postgres/import-json.js';
import { apiPool, asLibrarian, ownerPool, requireTestUrls, resetData } from './support/db.js';

const owner = ownerPool();
const api = apiPool();
const ROOT = path.resolve(import.meta.dirname, '../..');

const source = {
  version: 1,
  books: [
    {
      id: 'b1',
      title: 'Мастер и Маргарита',
      author: 'М. Булгаков',
      isbn: '978-5-17-090631-9',
      copies: 2,
    },
    // Тот же ISBN у другой книги: уникальности по isbn нет, импорт не падает
    {
      id: 'b2',
      title: 'Белая гвардия',
      author: 'М. Булгаков',
      isbn: '978-5-17-090631-9',
      copies: 1,
    },
  ],
  readers: [
    { id: 'r1', name: 'Анна', contact: 'anna@example.com' },
    { id: 'r2', name: 'Борис', contact: 'boris@example.com' },
  ],
  loans: [
    {
      id: 'l1',
      bookId: 'b1',
      readerId: 'r1',
      issuedAt: '2026-10-01T10:00:00.000Z',
      dueAt: '2026-10-15T10:00:00.000Z',
      returnedAt: '2026-10-10T08:30:00.000Z',
    },
    {
      id: 'l2',
      bookId: 'b2',
      readerId: 'r2',
      issuedAt: '2026-10-20T10:00:00.000Z',
      dueAt: '2026-11-03T10:00:00.000Z',
      returnedAt: null,
    },
  ],
};

let dir: string;
let file: string;

beforeEach(async () => {
  await resetData(owner);
  dir = await mkdtemp(path.join(tmpdir(), 'library-import-'));
  file = path.join(dir, 'library.json');
  await writeFile(file, JSON.stringify(source, null, 2));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

afterAll(async () => {
  await Promise.all([owner.end(), api.end()]);
});

async function count(table: 'books' | 'readers' | 'loans'): Promise<number> {
  const { rows } = await owner.query<{ n: string }>(`select count(*) as n from ${table}`);
  return Number(rows[0]?.n);
}

async function sha256(target: string): Promise<string> {
  return createHash('sha256')
    .update(await readFile(target))
    .digest('hex');
}

describe('importJsonFile', () => {
  it('imports books, readers and loans with the same ids', async () => {
    const report = await importJsonFile(file, api);

    expect(report).toEqual({
      books: { inserted: 2, skipped: 0 },
      readers: { inserted: 2, skipped: 0 },
      loans: { inserted: 2, skipped: 0 },
    });
    const books = await owner.query(
      'select id, title, author, isbn, copies from books order by id',
    );
    expect(books.rows).toEqual(source.books);
    const readers = await owner.query('select id, name, contact from readers order by id');
    expect(readers.rows).toEqual(source.readers);
    const loans = await owner.query('select id, book_id, reader_id from loans order by id');
    expect(loans.rows).toEqual([
      { id: 'l1', book_id: 'b1', reader_id: 'r1' },
      { id: 'l2', book_id: 'b2', reader_id: 'r2' },
    ]);
  });

  it('keeps returned loans and their dates', async () => {
    await importJsonFile(file, api);

    const { rows } = await owner.query<{
      issued_at: Date;
      due_at: Date;
      returned_at: Date | null;
    }>('select issued_at, due_at, returned_at from loans order by id');
    expect(rows[0]?.issued_at.toISOString()).toBe('2026-10-01T10:00:00.000Z');
    expect(rows[0]?.due_at.toISOString()).toBe('2026-10-15T10:00:00.000Z');
    expect(rows[0]?.returned_at?.toISOString()).toBe('2026-10-10T08:30:00.000Z');
    expect(rows[1]?.returned_at).toBeNull();
  });

  it('skips existing rows on the second run', async () => {
    await importJsonFile(file, api);
    const second = await importJsonFile(file, api);

    expect(second).toEqual({
      books: { inserted: 0, skipped: 2 },
      readers: { inserted: 0, skipped: 2 },
      loans: { inserted: 0, skipped: 2 },
    });
    expect(await count('books')).toBe(2);
    expect(await count('loans')).toBe(2);
  });

  it('does not overwrite an existing row with different data', async () => {
    await importJsonFile(file, api);
    await asLibrarian(api, (c) =>
      c.query("update books set title = 'Исправлено вручную' where id = 'b1'"),
    );

    await importJsonFile(file, api);

    const { rows } = await owner.query<{ title: string }>(
      "select title from books where id = 'b1'",
    );
    expect(rows[0]?.title).toBe('Исправлено вручную');
  });

  it('rolls back everything when a loan references a missing book', async () => {
    const broken = {
      ...source,
      loans: [...source.loans, { ...source.loans[1], id: 'l3', bookId: 'missing' }],
    };
    await writeFile(file, JSON.stringify(broken));

    await expect(importJsonFile(file, api)).rejects.toThrow();

    expect(await count('books')).toBe(0);
    expect(await count('readers')).toBe(0);
    expect(await count('loans')).toBe(0);
  });

  it('does not change the source file', async () => {
    const before = await sha256(file);

    await importJsonFile(file, api);
    await importJsonFile(file, api);

    expect(await sha256(file)).toBe(before);
  });
});

describe('db:import CLI', () => {
  // Без оболочки и без npx: на Windows обёртка npx без оболочки не запускается (ENOENT),
  // а оболочка с подставленными аргументами недопустима
  function runCli(args: string[]) {
    return spawnSync(
      process.execPath,
      [
        path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
        'src/server/cli/import.ts',
        ...args,
      ],
      {
        encoding: 'utf8',
        cwd: ROOT,
        env: { ...process.env, DATABASE_URL: requireTestUrls().apiUrl },
      },
    );
  }

  it('prints the report in Russian', () => {
    const first = runCli(['--file', file]);

    expect(first.status).toBe(0);
    expect(first.stdout).toContain('книги: перенесено 2 / пропущено 0');
    expect(first.stdout).toContain('читатели: перенесено 2 / пропущено 0');
    expect(first.stdout).toContain('выдачи: перенесено 2 / пропущено 0');

    const second = runCli(['--file', file]);
    expect(second.status).toBe(0);
    expect(second.stdout).toContain('книги: перенесено 0 / пропущено 2');
  });

  it('fails on a missing file without the connection string in the message', () => {
    const res = runCli(['--file', path.join(dir, 'missing.json')]);

    expect(res.status).toBe(1);
    expect(res.stderr).toContain('db:import:');
    expect(res.stderr).not.toContain(requireTestUrls().apiUrl);
  });
});
