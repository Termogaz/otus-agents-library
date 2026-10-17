import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Book, Loan, Reader } from '../../src/domain/index.js';
import { JsonFileRepository } from '../../src/server/json-file-repository.js';

const book: Book = {
  id: 'b1',
  title: 'Мастер и Маргарита',
  author: 'М. Булгаков',
  isbn: '978-5-17-090669-1',
  copies: 2,
};
const reader: Reader = { id: 'r1', name: 'Анна', contact: 'anna@example.com' };

const issuedAt = new Date('2026-10-17T10:00:00Z');
const dueAt = new Date('2026-10-31T10:00:00Z');
const loan: Loan = { id: 'l1', bookId: 'b1', readerId: 'r1', issuedAt, dueAt, returnedAt: null };

describe('JsonFileRepository', () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'library-repo-'));
    file = join(dir, 'library.json');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns empty lists when the file does not exist', async () => {
    const repo = new JsonFileRepository(file);

    expect(await repo.listBooks()).toEqual([]);
    expect(await repo.listReaders()).toEqual([]);
    expect(await repo.listLoans()).toEqual([]);
  });

  it('returns undefined for unknown id', async () => {
    const repo = new JsonFileRepository(file);
    await repo.saveBook(book);

    expect(await repo.getBook('missing')).toBeUndefined();
    expect(await repo.getReader('missing')).toBeUndefined();
    expect(await repo.getLoan('missing')).toBeUndefined();
  });

  it('saves and reads back books, readers and loans', async () => {
    const repo = new JsonFileRepository(file);
    await repo.saveBook(book);
    await repo.saveReader(reader);
    await repo.saveLoan(loan);

    expect(await repo.getBook('b1')).toEqual(book);
    expect(await repo.getReader('r1')).toEqual(reader);
    expect(await repo.getLoan('l1')).toEqual(loan);
  });

  it('keeps data for a new repository instance on the same file', async () => {
    const first = new JsonFileRepository(file);
    await first.saveBook(book);
    await first.saveReader(reader);
    await first.saveLoan(loan);

    const second = new JsonFileRepository(file);

    expect(await second.listBooks()).toEqual([book]);
    expect(await second.listReaders()).toEqual([reader]);
    expect(await second.listLoans()).toEqual([loan]);
  });

  it('restores loan dates as Date objects', async () => {
    const returnedAt = new Date('2026-10-20T12:30:00Z');
    await new JsonFileRepository(file).saveLoan({ ...loan, returnedAt });

    const restored = await new JsonFileRepository(file).getLoan('l1');

    expect(restored?.issuedAt).toBeInstanceOf(Date);
    expect(restored?.dueAt).toBeInstanceOf(Date);
    expect(restored?.returnedAt).toBeInstanceOf(Date);
    expect(restored).toEqual({ ...loan, returnedAt });
  });

  it('keeps null returnedAt for a loan that is not returned', async () => {
    await new JsonFileRepository(file).saveLoan(loan);

    const restored = await new JsonFileRepository(file).getLoan('l1');

    expect(restored?.returnedAt).toBeNull();
  });

  it('replaces a record with the same id instead of adding a duplicate', async () => {
    const repo = new JsonFileRepository(file);
    await repo.saveBook(book);
    await repo.saveBook({ ...book, copies: 5 });

    expect(await repo.listBooks()).toEqual([{ ...book, copies: 5 }]);
  });

  it('filters loans by book and by reader', async () => {
    const repo = new JsonFileRepository(file);
    const other: Loan = { ...loan, id: 'l2', bookId: 'b2', readerId: 'r1' };
    const third: Loan = { ...loan, id: 'l3', bookId: 'b1', readerId: 'r2' };
    await repo.saveLoan(loan);
    await repo.saveLoan(other);
    await repo.saveLoan(third);

    expect(await repo.listLoans({ bookId: 'b1' })).toEqual([loan, third]);
    expect(await repo.listLoans({ readerId: 'r1' })).toEqual([loan, other]);
    expect(await repo.listLoans({ bookId: 'b1', readerId: 'r1' })).toEqual([loan]);
  });

  it('keeps every record when saves run concurrently', async () => {
    const repo = new JsonFileRepository(file);
    const ids = Array.from({ length: 10 }, (_, i) => `b${i}`);

    await Promise.all(ids.map((id) => repo.saveBook({ ...book, id })));

    const saved = await new JsonFileRepository(file).listBooks();
    expect(saved.map((b) => b.id).sort()).toEqual([...ids].sort());
  });

  it('rejects a file that is not valid JSON', async () => {
    await writeFile(file, '{ not json');

    await expect(new JsonFileRepository(file).listBooks()).rejects.toMatchObject({
      code: 'INVALID_STORAGE_FILE',
    });
  });

  it('rejects a file that does not match the schema', async () => {
    await writeFile(
      file,
      JSON.stringify({ version: 1, books: [{ id: 'b1', copies: 'two' }], readers: [], loans: [] }),
    );

    await expect(new JsonFileRepository(file).listBooks()).rejects.toMatchObject({
      code: 'INVALID_STORAGE_FILE',
    });
  });

  it('rejects a file with an unsupported version', async () => {
    await writeFile(file, JSON.stringify({ version: 99, books: [], readers: [], loans: [] }));

    await expect(new JsonFileRepository(file).listBooks()).rejects.toMatchObject({
      code: 'UNSUPPORTED_STORAGE_VERSION',
    });
  });
});
