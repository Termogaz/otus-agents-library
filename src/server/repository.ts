import type { Book, Loan, Reader } from '../domain/index.js';

export type LoanFilter = { bookId?: string; readerId?: string };

// forUpdate: прочитать строку с блокировкой до конца транзакции (Postgres: select … for update).
// Нужен там, где решение зависит от прочитанного и потом сохраняется: выдача, возврат.
export type ReadOptions = { forUpdate?: boolean };

// Доступ к данным библиотеки. Методы асинхронные, чтобы JSON-файл можно было заменить на SQLite.
// save* создаёт запись или заменяет существующую с тем же id.
export interface LibraryRepository {
  listBooks(): Promise<Book[]>;
  getBook(id: string, options?: ReadOptions): Promise<Book | undefined>;
  saveBook(book: Book): Promise<void>;
  // Удаляет книгу; правило «с выдачами нельзя» проверяет домен, не репозиторий
  deleteBook(id: string): Promise<void>;

  listReaders(): Promise<Reader[]>;
  getReader(id: string, options?: ReadOptions): Promise<Reader | undefined>;
  saveReader(reader: Reader): Promise<void>;
  deleteReader(id: string): Promise<void>;

  listLoans(filter?: LoanFilter): Promise<Loan[]>;
  getLoan(id: string, options?: ReadOptions): Promise<Loan | undefined>;
  saveLoan(loan: Loan): Promise<void>;

  // Число активных (невозвращённых) выдач по id книги; книги без выдач в карте нет
  activeLoanCounts(): Promise<Map<string, number>>;
}

export type StorageErrorCode = 'INVALID_STORAGE_FILE' | 'UNSUPPORTED_STORAGE_VERSION';

export class StorageError extends Error {
  constructor(
    readonly code: StorageErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'StorageError';
  }
}
