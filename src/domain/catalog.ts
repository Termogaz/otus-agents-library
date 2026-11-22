import type { Loan } from './types.js';

export type CatalogErrorCode =
  | 'COPIES_BELOW_ACTIVE_LOANS'
  | 'BOOK_HAS_ACTIVE_LOANS'
  | 'BOOK_HAS_LOAN_HISTORY'
  | 'READER_HAS_ACTIVE_LOANS'
  | 'READER_HAS_LOAN_HISTORY';

export type CatalogResult = { ok: true } | { ok: false; code: CatalogErrorCode };

// Экземпляров не может быть меньше, чем сейчас выдано: ровно столько — можно
export function checkCopiesChange({
  copies,
  activeLoans,
}: {
  copies: number;
  activeLoans: number;
}): CatalogResult {
  return copies < activeLoans ? { ok: false, code: 'COPIES_BELOW_ACTIVE_LOANS' } : { ok: true };
}

// loans — все выдачи книги. Активная выдача важнее истории: отказ называет именно её
export function checkBookDeletion(loans: readonly Loan[]): CatalogResult {
  if (loans.some((l) => l.returnedAt === null)) {
    return { ok: false, code: 'BOOK_HAS_ACTIVE_LOANS' };
  }
  if (loans.length > 0) return { ok: false, code: 'BOOK_HAS_LOAN_HISTORY' };
  return { ok: true };
}

// loans — все выдачи читателя; правило то же, что у книги
export function checkReaderDeletion(loans: readonly Loan[]): CatalogResult {
  if (loans.some((l) => l.returnedAt === null)) {
    return { ok: false, code: 'READER_HAS_ACTIVE_LOANS' };
  }
  if (loans.length > 0) return { ok: false, code: 'READER_HAS_LOAN_HISTORY' };
  return { ok: true };
}
