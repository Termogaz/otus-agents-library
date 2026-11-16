import { describe, expect, it } from 'vitest';
import type { LoanView } from '../../src/client/api.js';
import {
  activeLoanCount,
  formatDate,
  loanStatus,
  orderLoans,
  readDueAt,
} from '../../src/client-v2/loan-view.js';

// Выдача для тестов: поля, не важные в проверке, заполнены по умолчанию
function loan(overrides: Partial<LoanView> & { id: string }): LoanView {
  return {
    bookId: 'b1',
    readerId: 'r1',
    issuedAt: '2026-11-01T10:00:00.000Z',
    dueAt: '2026-11-15T10:00:00.000Z',
    returnedAt: null,
    overdue: false,
    ...overrides,
  };
}

describe('loan ordering and status', () => {
  it('puts overdue loans first, then active by due date, then returned newest first', () => {
    const loans = [
      loan({ id: 'returned-old', returnedAt: '2026-11-05T10:00:00.000Z' }),
      loan({ id: 'active-late', dueAt: '2026-12-01T10:00:00.000Z' }),
      loan({ id: 'returned-new', returnedAt: '2026-11-10T10:00:00.000Z' }),
      loan({ id: 'overdue-late', dueAt: '2026-11-08T10:00:00.000Z', overdue: true }),
      loan({ id: 'active-soon', dueAt: '2026-11-20T10:00:00.000Z' }),
      loan({ id: 'overdue-early', dueAt: '2026-11-03T10:00:00.000Z', overdue: true }),
    ];

    expect(orderLoans(loans).map((l) => l.id)).toEqual([
      'overdue-early',
      'overdue-late',
      'active-soon',
      'active-late',
      'returned-new',
      'returned-old',
    ]);
  });

  it('does not mutate the input array', () => {
    const loans = [
      loan({ id: 'b', returnedAt: '2026-11-05T10:00:00.000Z' }),
      loan({ id: 'a', overdue: true }),
    ];
    const snapshot = loans.map((l) => l.id);

    orderLoans(loans);

    expect(loans.map((l) => l.id)).toEqual(snapshot);
  });

  it('returns empty list for no loans', () => {
    expect(orderLoans([])).toEqual([]);
  });

  it('keeps server order for loans with equal due dates', () => {
    const loans = [loan({ id: 'first' }), loan({ id: 'second' }), loan({ id: 'third' })];

    expect(orderLoans(loans).map((l) => l.id)).toEqual(['first', 'second', 'third']);
  });

  it('counts only active loans of the reader', () => {
    const loans = [
      loan({ id: 'l1', readerId: 'r1' }),
      loan({ id: 'l2', readerId: 'r1', overdue: true }),
      loan({ id: 'l3', readerId: 'r1', returnedAt: '2026-11-05T10:00:00.000Z' }),
      loan({ id: 'l4', readerId: 'r2' }),
    ];

    expect(activeLoanCount(loans, 'r1')).toBe(2);
    expect(activeLoanCount(loans, 'r2')).toBe(1);
    expect(activeLoanCount(loans, 'r3')).toBe(0);
  });

  it('describes loan status in Russian', () => {
    expect(loanStatus(loan({ id: 'a' }))).toBe('На руках');
    expect(loanStatus(loan({ id: 'b', overdue: true }))).toBe('Просрочена');
    expect(loanStatus(loan({ id: 'c', returnedAt: '2026-11-10T10:00:00.000Z' }))).toBe(
      'Возвращена 10.11.2026',
    );
  });
});

describe('loan view helpers', () => {
  it('formats ISO date as DD.MM.YYYY', () => {
    expect(formatDate('2026-11-28T10:00:00.000Z')).toMatch(/^\d\d\.\d\d\.\d{4}$/);
    expect(formatDate('2026-11-28T10:00:00.000Z')).toBe('28.11.2026');
  });

  it('keeps an unreadable date as is', () => {
    expect(formatDate('не дата')).toBe('не дата');
  });

  it('reads dueAt from checkout response', () => {
    expect(readDueAt({ id: 'l1', dueAt: '2026-11-28T10:00:00.000Z' })).toBe(
      '2026-11-28T10:00:00.000Z',
    );
  });

  it('returns null when response has no string dueAt', () => {
    expect(readDueAt(null)).toBeNull();
    expect(readDueAt('2026-11-28')).toBeNull();
    expect(readDueAt({ id: 'l1' })).toBeNull();
    expect(readDueAt({ dueAt: 42 })).toBeNull();
  });
});
