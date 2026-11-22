import { describe, expect, it } from 'vitest';
import {
  checkBookDeletion,
  checkCopiesChange,
  checkReaderDeletion,
} from '../../src/domain/catalog.js';
import type { Loan } from '../../src/domain/types.js';

const now = new Date('2026-10-17T10:00:00Z');

function loan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: 'l1',
    bookId: 'b1',
    readerId: 'r1',
    issuedAt: now,
    dueAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
    returnedAt: null,
    ...overrides,
  };
}

const closed = loan({ id: 'l2', returnedAt: now });

describe('checkCopiesChange', () => {
  it('allows copies equal to active loans', () => {
    expect(checkCopiesChange({ copies: 2, activeLoans: 2 })).toEqual({ ok: true });
  });

  it('rejects copies below active loans', () => {
    expect(checkCopiesChange({ copies: 1, activeLoans: 2 })).toEqual({
      ok: false,
      code: 'COPIES_BELOW_ACTIVE_LOANS',
    });
  });
});

describe('checkBookDeletion', () => {
  it('rejects deleting a book with an active loan', () => {
    expect(checkBookDeletion([closed, loan()])).toEqual({
      ok: false,
      code: 'BOOK_HAS_ACTIVE_LOANS',
    });
  });

  it('rejects deleting a book with loan history', () => {
    expect(checkBookDeletion([closed])).toEqual({ ok: false, code: 'BOOK_HAS_LOAN_HISTORY' });
  });

  it('allows deleting a book without loans', () => {
    expect(checkBookDeletion([])).toEqual({ ok: true });
  });
});

describe('checkReaderDeletion', () => {
  it('rejects deleting a reader with an active loan', () => {
    expect(checkReaderDeletion([closed, loan()])).toEqual({
      ok: false,
      code: 'READER_HAS_ACTIVE_LOANS',
    });
  });

  it('rejects deleting a reader with loan history', () => {
    expect(checkReaderDeletion([closed])).toEqual({ ok: false, code: 'READER_HAS_LOAN_HISTORY' });
  });

  it('allows deleting a reader without loans', () => {
    expect(checkReaderDeletion([])).toEqual({ ok: true });
  });
});
