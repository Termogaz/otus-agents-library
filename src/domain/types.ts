// Сущности библиотеки. Даты — объекты Date; сериализацию делает server.

export type Book = {
  id: string;
  title: string;
  author: string;
  isbn: string;
  // Сколько всего экземпляров в фонде
  copies: number;
};

export type Reader = {
  id: string;
  name: string;
  contact: string;
};

export type Loan = {
  id: string;
  bookId: string;
  readerId: string;
  issuedAt: Date;
  dueAt: Date;
  // null — книга ещё у читателя
  returnedAt: Date | null;
};

export type LoanPolicy = {
  // Сколько книг одновременно может быть у читателя
  loanLimit: number;
  // На сколько дней выдаётся книга
  loanDays: number;
};

export type LoanErrorCode = 'NO_FREE_COPIES' | 'LOAN_LIMIT_REACHED' | 'LOAN_ALREADY_RETURNED';

export type LoanResult = { ok: true; loan: Loan } | { ok: false; code: LoanErrorCode };
