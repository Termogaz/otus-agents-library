import type { Book, Loan, LoanPolicy, LoanResult, Reader } from './types.js';

export const DEFAULT_LOAN_POLICY: LoanPolicy = { loanLimit: 3, loanDays: 14 };

const DAY_MS = 24 * 60 * 60 * 1000;

export type CheckoutInput = {
  loanId: string;
  book: Book;
  reader: Reader;
  // Выдачи, по которым считаются занятые экземпляры и лимит; возвращённые не учитываются
  loans: readonly Loan[];
  now: Date;
  policy?: LoanPolicy;
};

export function checkoutBook({
  loanId,
  book,
  reader,
  loans,
  now,
  policy = DEFAULT_LOAN_POLICY,
}: CheckoutInput): LoanResult {
  const active = loans.filter((l) => l.returnedAt === null);

  // Нехватка экземпляров проверяется раньше лимита: это свойство книги, а не читателя
  if (active.filter((l) => l.bookId === book.id).length >= book.copies) {
    return { ok: false, code: 'NO_FREE_COPIES' };
  }
  if (active.filter((l) => l.readerId === reader.id).length >= policy.loanLimit) {
    return { ok: false, code: 'LOAN_LIMIT_REACHED' };
  }

  return {
    ok: true,
    loan: {
      id: loanId,
      bookId: book.id,
      readerId: reader.id,
      issuedAt: now,
      dueAt: new Date(now.getTime() + policy.loanDays * DAY_MS),
      returnedAt: null,
    },
  };
}

export function returnBook({ loan, now }: { loan: Loan; now: Date }): LoanResult {
  if (loan.returnedAt !== null) {
    return { ok: false, code: 'LOAN_ALREADY_RETURNED' };
  }
  return { ok: true, loan: { ...loan, returnedAt: now } };
}

// Просрочена — не возвращена и срок уже прошёл; в сам момент срока просрочки ещё нет
export function isOverdue(loan: Loan, now: Date): boolean {
  return loan.returnedAt === null && now.getTime() > loan.dueAt.getTime();
}
