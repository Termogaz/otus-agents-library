// Адаптер API в памяти браузера для прототипа: форма объекта `api` из старого клиента,
// но без сети. Состояние живёт в экземпляре, перезагрузка страницы возвращает исходные данные.
// Правила выдачи берутся из чистых функций домена (решение автора Q1, вариант A): импорт
// `src/domain` разрешён только в каталоге `src/client-v2/demo/` и закреплён тестом слоёв.

import {
  availableCopies,
  checkoutBook,
  isOverdue,
  returnBook,
  type Book,
  type Loan,
  type Reader,
} from '../../domain/index';
import {
  ApiError,
  type api,
  type BookView,
  type LoanView,
  type ReaderView,
} from '../../client/api';
import { createDemoData } from './demo-data';

export type DemoApiOptions = {
  // Часы передаются снаружи: даты демо-данных и действий считаются только от них
  now?: () => Date;
  // Генератор id новых записей
  newId?: () => string;
  // Сценарий «Пусто»: списки без записей
  empty?: boolean;
  // Сценарий «Сбой»: списки отклоняются обычной ошибкой, как недоступный сервер
  failLists?: boolean;
  // Сценарий «Сохранено»: действие выполняется, а следующие вызовы списков отклоняются
  failListsAfterAction?: boolean;
  // Сценарий «Ожидание»: действие не завершается, кнопка остаётся заблокированной
  holdActions?: boolean;
};

// Запись выдачи в форме ответа сервера: ISO-строки и без поля `overdue`
type LoanRecord = Omit<LoanView, 'overdue'>;

function toLoanRecord(loan: Loan): LoanRecord {
  return {
    id: loan.id,
    bookId: loan.bookId,
    readerId: loan.readerId,
    issuedAt: loan.issuedAt.toISOString(),
    dueAt: loan.dueAt.toISOString(),
    returnedAt: loan.returnedAt === null ? null : loan.returnedAt.toISOString(),
  };
}

// Непустая строка после обрезки пробелов, как `z.string().trim().min(1)` на сервере
function requireText(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') throw new ApiError('VALIDATION_ERROR');
  return value.trim();
}

function requireCopies(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new ApiError('VALIDATION_ERROR');
  }
  return value;
}

export function createDemoApi(options: DemoApiOptions = {}): typeof api {
  const {
    now = () => new Date(),
    newId = () => crypto.randomUUID(),
    empty = false,
    failLists = false,
    failListsAfterAction = false,
    holdActions = false,
  } = options;

  // Начальное состояние в форме домена: даты — Date
  const seed = empty ? { books: [], readers: [], loans: [] } : createDemoData(now());
  let books: Book[] = seed.books.map(({ id, title, author, isbn, copies }) => ({
    id,
    title,
    author,
    isbn,
    copies,
  }));
  let readers: Reader[] = seed.readers.map((reader) => ({ ...reader }));
  let loans: Loan[] = seed.loans.map((loan) => ({
    id: loan.id,
    bookId: loan.bookId,
    readerId: loan.readerId,
    issuedAt: new Date(loan.issuedAt),
    dueAt: new Date(loan.dueAt),
    returnedAt: loan.returnedAt === null ? null : new Date(loan.returnedAt),
  }));

  let listsBroken = failLists;

  function guardLists(): void {
    if (listsBroken) throw new Error('demo api: lists are failing');
  }

  // Действие: в сценарии «Ожидание» обещание не разрешается; после успешного выполнения
  // в сценарии «Сохранено» списки перестают отвечать
  async function action<T>(run: () => T): Promise<T> {
    if (holdActions) return new Promise<T>(() => undefined);
    const result = run();
    if (failListsAfterAction) listsBroken = true;
    return result;
  }

  return {
    listBooks: async (): Promise<BookView[]> => {
      guardLists();
      return books.map((book) => ({ ...book, available: availableCopies(book, loans) }));
    },
    addBook: (input) =>
      action(() => {
        const book: Book = {
          id: newId(),
          title: requireText(input.title),
          author: requireText(input.author),
          isbn: requireText(input.isbn),
          copies: requireCopies(input.copies),
        };
        books = [...books, book];
        return book;
      }),
    listReaders: async (): Promise<ReaderView[]> => {
      guardLists();
      return readers.map((reader) => ({ ...reader }));
    },
    addReader: (input) =>
      action(() => {
        const reader: Reader = {
          id: newId(),
          name: requireText(input.name),
          contact: requireText(input.contact),
        };
        readers = [...readers, reader];
        return reader;
      }),
    listLoans: async (): Promise<LoanView[]> => {
      guardLists();
      const at = now();
      return loans.map((loan) => ({ ...toLoanRecord(loan), overdue: isOverdue(loan, at) }));
    },
    checkout: (bookId, readerId) =>
      action(() => {
        const book = books.find((b) => b.id === bookId);
        if (!book) throw new ApiError('BOOK_NOT_FOUND');
        const reader = readers.find((r) => r.id === readerId);
        if (!reader) throw new ApiError('READER_NOT_FOUND');

        const result = checkoutBook({ loanId: newId(), book, reader, loans, now: now() });
        if (!result.ok) throw new ApiError(result.code);

        loans = [...loans, result.loan];
        return toLoanRecord(result.loan);
      }),
    returnLoan: (loanId) =>
      action(() => {
        const existing = loans.find((l) => l.id === loanId);
        if (!existing) throw new ApiError('LOAN_NOT_FOUND');

        const result = returnBook({ loan: existing, now: now() });
        if (!result.ok) throw new ApiError(result.code);

        loans = loans.map((l) => (l.id === loanId ? result.loan : l));
        return toLoanRecord(result.loan);
      }),
  };
}
