import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { JsonFileRepository } from '../../src/server/json-file-repository.js';

const seedPath = join(import.meta.dirname, '../../data/seed.json');

type Seed = {
  books: { id: string; title: string; author: string; copies: number }[];
  readers: { id: string; name: string; contact: string }[];
  loans: { id: string }[];
};

describe('data/seed.json', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'library-seed-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('loads seed through the JSON repository in the current storage format', async () => {
    // Копия, чтобы тест не менял исходный файл
    const copy = join(dir, 'library.json');
    copyFileSync(seedPath, copy);
    const repo = new JsonFileRepository(copy);

    expect((await repo.listBooks()).length).toBeGreaterThanOrEqual(6);
    expect((await repo.listReaders()).length).toBeGreaterThanOrEqual(4);
    // Выдач в семени нет: их сроки устарели бы сразу после записи
    expect(await repo.listLoans()).toEqual([]);
  });

  it('has a book with a single copy', () => {
    const seed = JSON.parse(readFileSync(seedPath, 'utf8')) as Seed;
    expect(seed.books.some((b) => b.copies === 1)).toBe(true);
  });

  it('has unique ids', () => {
    const seed = JSON.parse(readFileSync(seedPath, 'utf8')) as Seed;
    for (const items of [seed.books, seed.readers, seed.loans]) {
      const ids = items.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('contains no real names or contacts', () => {
    const seed = JSON.parse(readFileSync(seedPath, 'utf8')) as Seed;
    for (const book of seed.books) {
      expect(book.title.startsWith('Демо-')).toBe(true);
      expect(book.author.startsWith('Демо-')).toBe(true);
    }
    for (const reader of seed.readers) {
      expect(reader.name.startsWith('Демо-')).toBe(true);
      expect(reader.contact.endsWith('@example.test')).toBe(true);
    }
  });
});
