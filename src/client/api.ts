// HTTP-клиент API библиотеки. Даты приходят ISO-строками.

export type BookView = {
  id: string;
  title: string;
  author: string;
  isbn: string;
  copies: number;
  available: number;
};

export type ReaderView = { id: string; name: string; contact: string };

export type LoanView = {
  id: string;
  bookId: string;
  readerId: string;
  issuedAt: string;
  dueAt: string;
  returnedAt: string | null;
  overdue: boolean;
};

// Отказ API с кодом из ответа; текст для пользователя — в errorMessage
export class ApiError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

const messages: Record<string, string> = {
  NO_FREE_COPIES: 'Нет свободных экземпляров',
  LOAN_LIMIT_REACHED: 'Читатель уже взял максимум книг',
  LOAN_ALREADY_RETURNED: 'Книга уже возвращена',
  VALIDATION_ERROR: 'Проверьте заполнение полей',
  BOOK_NOT_FOUND: 'Книга не найдена',
  READER_NOT_FOUND: 'Читатель не найден',
  LOAN_NOT_FOUND: 'Выдача не найдена',
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return messages[error.code] ?? 'Ошибка сервера';
  return 'Сервер недоступен';
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data: unknown = await res.json();
  if (!res.ok) {
    const code = (data as { code?: unknown } | null)?.code;
    throw new ApiError(typeof code === 'string' ? code : 'INTERNAL_ERROR');
  }
  return data as T;
}

export const api = {
  listBooks: () => call<BookView[]>('GET', '/api/books'),
  addBook: (book: Omit<BookView, 'id' | 'available'>) => call<unknown>('POST', '/api/books', book),
  listReaders: () => call<ReaderView[]>('GET', '/api/readers'),
  addReader: (reader: Omit<ReaderView, 'id'>) => call<unknown>('POST', '/api/readers', reader),
  listLoans: () => call<LoanView[]>('GET', '/api/loans'),
  checkout: (bookId: string, readerId: string) =>
    call<unknown>('POST', '/api/loans', { bookId, readerId }),
  returnLoan: (loanId: string) => call<unknown>('POST', `/api/loans/${loanId}/return`),
};
