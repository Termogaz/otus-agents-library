import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorMessage } from '../../src/client/api.js';
import { createDemoApi } from '../../src/client-v2/demo/demo-api.js';

// Фиксированное «сейчас»: все даты демо-данных считаются от него
const NOW = new Date('2026-11-14T10:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function makeApi(options: Parameters<typeof createDemoApi>[0] = {}) {
  return createDemoApi({ now: () => NOW, ...options });
}

async function messageOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return errorMessage(error);
  }
  throw new Error('expected call to fail');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('demo api lists', () => {
  it('lists demo books with available copies matching active loans', async () => {
    const api = makeApi();
    const [books, loans] = await Promise.all([api.listBooks(), api.listLoans()]);

    expect(books.length).toBeGreaterThanOrEqual(6);
    for (const book of books) {
      const issued = loans.filter((l) => l.bookId === book.id && l.returnedAt === null).length;
      expect(book.available, book.title).toBe(book.copies - issued);
    }
    // Есть книга без свободных экземпляров и книга со свободными
    expect(books.some((b) => b.available === 0)).toBe(true);
    expect(books.some((b) => b.available > 0)).toBe(true);
  });

  it('lists an overdue loan relative to the given now', async () => {
    const loans = await makeApi().listLoans();
    const overdue = loans.filter((l) => l.overdue);

    expect(overdue).toHaveLength(1);
    const loan = overdue[0];
    expect(loan?.returnedAt).toBeNull();
    expect(NOW.getTime() - Date.parse(loan?.issuedAt ?? '')).toBe(20 * DAY_MS);
    expect(NOW.getTime() - Date.parse(loan?.dueAt ?? '')).toBe(6 * DAY_MS);
  });

  it('marks a loan issued three days ago as not overdue', async () => {
    const loans = await makeApi().listLoans();
    const recent = loans.find((l) => NOW.getTime() - Date.parse(l.issuedAt) === 3 * DAY_MS);

    expect(recent).toBeDefined();
    expect(recent?.returnedAt).toBeNull();
    expect(recent?.overdue).toBe(false);
  });

  it('has a returned loan and a reader at the loan limit', async () => {
    const loans = await makeApi().listLoans();

    const returned = loans.find((l) => l.returnedAt !== null);
    expect(returned?.overdue).toBe(false);
    expect(NOW.getTime() - Date.parse(returned?.issuedAt ?? '')).toBe(30 * DAY_MS);
    expect(NOW.getTime() - Date.parse(returned?.returnedAt ?? '')).toBe(18 * DAY_MS);

    const activeByReader = new Map<string, number>();
    for (const loan of loans.filter((l) => l.returnedAt === null)) {
      activeByReader.set(loan.readerId, (activeByReader.get(loan.readerId) ?? 0) + 1);
    }
    expect(Math.max(...activeByReader.values())).toBe(3);
  });

  it('contains no real names or contacts', async () => {
    const api = makeApi();
    const [books, readers] = await Promise.all([api.listBooks(), api.listReaders()]);

    expect(books.length).toBeGreaterThanOrEqual(6);
    expect(readers.length).toBeGreaterThanOrEqual(4);
    for (const book of books) {
      expect(book.title.startsWith('Демо-'), book.title).toBe(true);
      expect(book.author.startsWith('Демо-'), book.author).toBe(true);
    }
    for (const reader of readers) {
      expect(reader.name.startsWith('Демо-'), reader.name).toBe(true);
      expect(reader.contact.endsWith('@example.test'), reader.contact).toBe(true);
    }
  });

  it('returns empty lists in the empty scenario', async () => {
    const api = makeApi({ empty: true });

    expect(await api.listBooks()).toEqual([]);
    expect(await api.listReaders()).toEqual([]);
    expect(await api.listLoans()).toEqual([]);
  });

  it('rejects list calls in the failed scenario with a non-API error', async () => {
    const api = makeApi({ failLists: true });

    expect(await messageOf(api.listBooks())).toBe('Сервер недоступен');
    expect(await messageOf(api.listReaders())).toBe('Сервер недоступен');
    expect(await messageOf(api.listLoans())).toBe('Сервер недоступен');
  });

  it('does not call fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const api = makeApi();

    await api.listBooks();
    await api.listReaders();
    await api.listLoans();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
