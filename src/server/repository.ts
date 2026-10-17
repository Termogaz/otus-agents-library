import type { Book, Loan, Reader } from '../domain/index.js';

export type LoanFilter = { bookId?: string; readerId?: string };

// Доступ к данным библиотеки. Методы асинхронные, чтобы JSON-файл можно было заменить на SQLite.
// save* создаёт запись или заменяет существующую с тем же id.
export interface LibraryRepository {
  listBooks(): Promise<Book[]>;
  getBook(id: string): Promise<Book | undefined>;
  saveBook(book: Book): Promise<void>;

  listReaders(): Promise<Reader[]>;
  getReader(id: string): Promise<Reader | undefined>;
  saveReader(reader: Reader): Promise<void>;

  listLoans(filter?: LoanFilter): Promise<Loan[]>;
  getLoan(id: string): Promise<Loan | undefined>;
  saveLoan(loan: Loan): Promise<void>;
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
