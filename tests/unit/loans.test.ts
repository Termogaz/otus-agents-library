import { describe, expect, it } from 'vitest';
import { checkoutBook, isOverdue, returnBook } from '../../src/domain/loans.js';
import type { Book, Loan, Reader } from '../../src/domain/types.js';

const now = new Date('2026-10-17T10:00:00Z');
const day = 24 * 60 * 60 * 1000;

const book: Book = {
  id: 'b1',
  title: 'Мастер и Маргарита',
  author: 'М. Булгаков',
  isbn: '978-5-17-090631-9',
  copies: 2,
};

const reader: Reader = { id: 'r1', name: 'Анна', contact: 'anna@example.com' };

function loan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: 'l0',
    bookId: 'b1',
    readerId: 'r2',
    issuedAt: new Date(now.getTime() - 3 * day),
    dueAt: new Date(now.getTime() + 11 * day),
    returnedAt: null,
    ...overrides,
  };
}

describe('checkoutBook', () => {
  it('issues loan due in 14 days', () => {
    const result = checkoutBook({ loanId: 'l1', book, reader, loans: [], now });

    expect(result).toEqual({
      ok: true,
      loan: {
        id: 'l1',
        bookId: 'b1',
        readerId: 'r1',
        issuedAt: now,
        dueAt: new Date('2026-10-31T10:00:00Z'),
        returnedAt: null,
      },
    });
  });

  it('issues the last free copy', () => {
    const result = checkoutBook({ loanId: 'l1', book, reader, loans: [loan()], now });

    expect(result.ok).toBe(true);
  });

  it('rejects loan when no free copies left', () => {
    const loans = [loan({ id: 'l2' }), loan({ id: 'l3', readerId: 'r3' })];

    const result = checkoutBook({ loanId: 'l1', book, reader, loans, now });

    expect(result).toEqual({ ok: false, code: 'NO_FREE_COPIES' });
  });

  it('does not count returned loans as taken copies', () => {
    const loans = [loan({ id: 'l2' }), loan({ id: 'l3', returnedAt: now })];

    const result = checkoutBook({ loanId: 'l1', book, reader, loans, now });

    expect(result.ok).toBe(true);
  });

  it('issues loan when reader is one book below the limit', () => {
    const loans = [
      loan({ id: 'l2', bookId: 'b2', readerId: 'r1' }),
      loan({ id: 'l3', bookId: 'b3', readerId: 'r1' }),
    ];

    const result = checkoutBook({ loanId: 'l1', book, reader, loans, now });

    expect(result.ok).toBe(true);
  });

  it('rejects loan when reader reached the limit', () => {
    const loans = [
      loan({ id: 'l2', bookId: 'b2', readerId: 'r1' }),
      loan({ id: 'l3', bookId: 'b3', readerId: 'r1' }),
      loan({ id: 'l4', bookId: 'b4', readerId: 'r1' }),
    ];

    const result = checkoutBook({ loanId: 'l1', book, reader, loans, now });

    expect(result).toEqual({ ok: false, code: 'LOAN_LIMIT_REACHED' });
  });

  it('does not count returned loans towards the limit', () => {
    const loans = [
      loan({ id: 'l2', bookId: 'b2', readerId: 'r1' }),
      loan({ id: 'l3', bookId: 'b3', readerId: 'r1' }),
      loan({ id: 'l4', bookId: 'b4', readerId: 'r1', returnedAt: now }),
    ];

    const result = checkoutBook({ loanId: 'l1', book, reader, loans, now });

    expect(result.ok).toBe(true);
  });

  it('reports NO_FREE_COPIES when both rules are violated', () => {
    const loans = [
      loan({ id: 'l2', readerId: 'r1' }),
      loan({ id: 'l3', readerId: 'r1' }),
      loan({ id: 'l4', bookId: 'b4', readerId: 'r1' }),
    ];

    const result = checkoutBook({ loanId: 'l1', book, reader, loans, now });

    expect(result).toEqual({ ok: false, code: 'NO_FREE_COPIES' });
  });

  it('applies custom loan policy', () => {
    const policy = { loanLimit: 1, loanDays: 7 };

    const issued = checkoutBook({ loanId: 'l1', book, reader, loans: [], now, policy });
    const rejected = checkoutBook({
      loanId: 'l2',
      book,
      reader,
      loans: [loan({ bookId: 'b2', readerId: 'r1' })],
      now,
      policy,
    });

    expect(issued).toMatchObject({ ok: true, loan: { dueAt: new Date('2026-10-24T10:00:00Z') } });
    expect(rejected).toEqual({ ok: false, code: 'LOAN_LIMIT_REACHED' });
  });
});

describe('returnBook', () => {
  it('marks loan as returned at the given time', () => {
    const result = returnBook({ loan: loan(), now });

    expect(result).toEqual({ ok: true, loan: { ...loan(), returnedAt: now } });
  });

  it('rejects return of an already returned loan', () => {
    const returned = loan({ returnedAt: new Date(now.getTime() - day) });

    const result = returnBook({ loan: returned, now });

    expect(result).toEqual({ ok: false, code: 'LOAN_ALREADY_RETURNED' });
  });

  it('does not mutate the original loan', () => {
    const original = loan();

    returnBook({ loan: original, now });

    expect(original.returnedAt).toBeNull();
  });
});

describe('isOverdue', () => {
  it('is not overdue when due tomorrow', () => {
    expect(isOverdue(loan({ dueAt: new Date(now.getTime() + day) }), now)).toBe(false);
  });

  it('is not overdue exactly at the due time', () => {
    expect(isOverdue(loan({ dueAt: now }), now)).toBe(false);
  });

  it('is overdue right after the due time', () => {
    expect(isOverdue(loan({ dueAt: new Date(now.getTime() - 1) }), now)).toBe(true);
  });

  it('is overdue when due yesterday', () => {
    expect(isOverdue(loan({ dueAt: new Date(now.getTime() - day) }), now)).toBe(true);
  });

  it('is not overdue once returned, even after the due time', () => {
    const returned = loan({ dueAt: new Date(now.getTime() - day), returnedAt: now });

    expect(isOverdue(returned, now)).toBe(false);
  });
});
