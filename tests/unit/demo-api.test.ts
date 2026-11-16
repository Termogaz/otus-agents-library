import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, errorMessage } from '../../src/client/api.js';
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

// Код отказа проверяем по ApiError.code, текст — через errorMessage
async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error.code;
    throw error;
  }
  throw new Error('expected call to fail');
}

// Книга без свободных экземпляров и читатель на лимите находятся по спискам, а не по id
async function findScenario(api: ReturnType<typeof makeApi>) {
  const [books, readers, loans] = await Promise.all([
    api.listBooks(),
    api.listReaders(),
    api.listLoans(),
  ]);
  const active = loans.filter((l) => l.returnedAt === null);
  const countOf = (readerId: string) => active.filter((l) => l.readerId === readerId).length;
  const soldOut = books.find((b) => b.available === 0);
  const free = books.find((b) => b.available > 0);
  const atLimit = readers.find((r) => countOf(r.id) >= 3);
  const idle = readers.find((r) => countOf(r.id) === 0);
  if (!soldOut || !free || !atLimit || !idle) throw new Error('demo scenario is incomplete');
  return { books, readers, loans, active, soldOut, free, atLimit, idle };
}

describe('demo api actions', () => {
  it('issues a free book and returns the saved loan', async () => {
    const api = makeApi({ newId: () => 'loan-new' });
    const { free, idle } = await findScenario(api);

    const saved = await api.checkout(free.id, idle.id);

    expect(saved).toEqual({
      id: 'loan-new',
      bookId: free.id,
      readerId: idle.id,
      issuedAt: NOW.toISOString(),
      dueAt: new Date(NOW.getTime() + 14 * DAY_MS).toISOString(),
      returnedAt: null,
    });
    const loans = await api.listLoans();
    expect(loans.find((l) => l.id === 'loan-new')?.overdue).toBe(false);
    const books = await api.listBooks();
    expect(books.find((b) => b.id === free.id)?.available).toBe(free.available - 1);
  });

  it('rejects checkout of a book without free copies with NO_FREE_COPIES', async () => {
    const api = makeApi();
    const { soldOut, idle } = await findScenario(api);

    expect(await codeOf(api.checkout(soldOut.id, idle.id))).toBe('NO_FREE_COPIES');
    expect(await messageOf(api.checkout(soldOut.id, idle.id))).toBe(
      errorMessage(new ApiError('NO_FREE_COPIES')),
    );
    expect(await messageOf(api.checkout(soldOut.id, idle.id))).toBe('Нет свободных экземпляров');
  });

  it('rejects checkout for a reader at the limit with LOAN_LIMIT_REACHED', async () => {
    const api = makeApi();
    const { free, atLimit } = await findScenario(api);

    expect(await codeOf(api.checkout(free.id, atLimit.id))).toBe('LOAN_LIMIT_REACHED');
    expect(await messageOf(api.checkout(free.id, atLimit.id))).toBe(
      'Читатель уже взял максимум книг',
    );
  });

  it('returns a loan once and rejects the second return with LOAN_ALREADY_RETURNED', async () => {
    const api = makeApi();
    const { active } = await findScenario(api);
    const loan = active[0];
    if (!loan) throw new Error('no active loan');

    const returned = await api.returnLoan(loan.id);

    expect(returned).toEqual({
      id: loan.id,
      bookId: loan.bookId,
      readerId: loan.readerId,
      issuedAt: loan.issuedAt,
      dueAt: loan.dueAt,
      returnedAt: NOW.toISOString(),
    });
    expect(await codeOf(api.returnLoan(loan.id))).toBe('LOAN_ALREADY_RETURNED');
    expect(await messageOf(api.returnLoan(loan.id))).toBe('Книга уже возвращена');
    // После возврата выдача не просрочена и не считается активной
    const after = (await api.listLoans()).find((l) => l.id === loan.id);
    expect(after?.returnedAt).toBe(NOW.toISOString());
    expect(after?.overdue).toBe(false);
  });

  it('rejects unknown book, reader and loan ids with not-found codes', async () => {
    const api = makeApi();
    const { free, idle } = await findScenario(api);

    expect(await codeOf(api.checkout('missing', idle.id))).toBe('BOOK_NOT_FOUND');
    expect(await codeOf(api.checkout(free.id, 'missing'))).toBe('READER_NOT_FOUND');
    expect(await codeOf(api.returnLoan('missing'))).toBe('LOAN_NOT_FOUND');
  });

  it('adds a book and a reader with generated ids', async () => {
    const ids = ['book-new', 'reader-new'];
    const api = makeApi({ newId: () => ids.shift() ?? 'extra' });

    await api.addBook({
      title: 'Демо-книга «Новая»',
      author: 'Демо-автор Новый',
      isbn: '1',
      copies: 2,
    });
    await api.addReader({ name: 'Демо-читатель Новый', contact: 'new@example.test' });

    const book = (await api.listBooks()).find((b) => b.id === 'book-new');
    expect(book?.copies).toBe(2);
    expect(book?.available).toBe(2);
    const reader = (await api.listReaders()).find((r) => r.id === 'reader-new');
    expect(reader?.name).toBe('Демо-читатель Новый');
  });

  it('rejects invalid book and reader fields with VALIDATION_ERROR', async () => {
    const api = makeApi();
    const book = { title: 'Демо-книга', author: 'Демо-автор', isbn: '1', copies: 1 };

    expect(await codeOf(api.addBook({ ...book, title: '  ' }))).toBe('VALIDATION_ERROR');
    expect(await codeOf(api.addBook({ ...book, author: '' }))).toBe('VALIDATION_ERROR');
    expect(await codeOf(api.addBook({ ...book, isbn: '' }))).toBe('VALIDATION_ERROR');
    expect(await codeOf(api.addBook({ ...book, copies: 0 }))).toBe('VALIDATION_ERROR');
    expect(await codeOf(api.addBook({ ...book, copies: 1.5 }))).toBe('VALIDATION_ERROR');
    expect(await codeOf(api.addReader({ name: '', contact: 'a@example.test' }))).toBe(
      'VALIDATION_ERROR',
    );
    expect(await codeOf(api.addReader({ name: 'Демо-читатель', contact: ' ' }))).toBe(
      'VALIDATION_ERROR',
    );
    expect(await messageOf(api.addBook({ ...book, copies: 0 }))).toBe('Проверьте заполнение полей');
  });

  it('fails list calls after a successful action in the saved scenario', async () => {
    const api = makeApi({ failListsAfterAction: true });
    const { free, idle } = await findScenario(api);

    await expect(api.checkout(free.id, idle.id)).resolves.toBeDefined();

    expect(await messageOf(api.listBooks())).toBe('Сервер недоступен');
    expect(await messageOf(api.listReaders())).toBe('Сервер недоступен');
    expect(await messageOf(api.listLoans())).toBe('Сервер недоступен');
  });

  it('keeps the action pending in the waiting scenario', async () => {
    const api = makeApi({ holdActions: true });
    const { free, idle, loans } = await findScenario(api);
    const pending = Symbol('pending');

    const outcome = await Promise.race([
      api.checkout(free.id, idle.id).then(
        () => 'settled',
        () => 'settled',
      ),
      // Маркер срабатывает после очереди микрозадач: уже отклонённое обещание успело бы выиграть гонку
      new Promise((resolve) => setTimeout(() => resolve(pending), 0)),
    ]);

    expect(outcome).toBe(pending);
    // Действие не выполнено: список выдач прежний
    expect(await api.listLoans()).toHaveLength(loans.length);
  });

  it('keeps state per instance', async () => {
    const first = makeApi({ newId: () => 'loan-a' });
    const second = makeApi();
    const { free, idle } = await findScenario(first);

    await first.checkout(free.id, idle.id);

    expect((await first.listLoans()).some((l) => l.id === 'loan-a')).toBe(true);
    expect((await second.listLoans()).some((l) => l.id === 'loan-a')).toBe(false);
  });
});
