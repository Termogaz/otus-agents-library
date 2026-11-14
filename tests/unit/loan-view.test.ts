import { describe, expect, it } from 'vitest';
import { formatDate, readDueAt } from '../../src/client-v2/loan-view.js';

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
