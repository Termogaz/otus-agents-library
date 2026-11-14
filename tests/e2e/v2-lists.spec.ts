import { expect, test } from '@playwright/test';
import type { BookView, LoanView, ReaderView } from '../../src/client/api';
import { stubLists } from './fake-api';

// Списки страницы /v2/ (FR-1, FR-4): порядок и статусы выдач, состояния загрузки и пустые тексты.
// Данные подменяются через stubLists, сервер для них не нужен.

test.use({ viewport: { width: 1280, height: 800 } });

function book(id: string, title: string, copies = 2, available = 1): BookView {
  return { id, title, author: 'М. Булгаков', isbn: '978-5-17-090631-9', copies, available };
}

function loan(overrides: Partial<LoanView> & { id: string; bookId: string }): LoanView {
  return {
    readerId: 'r1',
    issuedAt: '2026-10-20T10:00:00.000Z',
    dueAt: '2026-12-10T10:00:00.000Z',
    returnedAt: null,
    overdue: false,
    ...overrides,
  };
}

const reader: ReaderView = { id: 'r1', name: 'Анна Петрова', contact: 'anna@example.com' };

test('lists overdue loan first for any creation order', async ({ page }) => {
  const books = [
    book('b1', 'Книга-вернули'),
    book('b2', 'Книга-срок-поздно'),
    book('b3', 'Книга-просрочена-поздно'),
    book('b4', 'Книга-срок-скоро'),
    book('b5', 'Книга-просрочена-давно'),
  ];
  // Порядок ответа сервера намеренно перемешан: порядок создания не должен влиять на таблицу
  const loans = [
    loan({ id: 'l1', bookId: 'b1', returnedAt: '2026-11-10T10:00:00.000Z' }),
    loan({ id: 'l2', bookId: 'b2', dueAt: '2026-12-20T10:00:00.000Z' }),
    loan({ id: 'l3', bookId: 'b3', dueAt: '2026-11-05T10:00:00.000Z', overdue: true }),
    loan({ id: 'l4', bookId: 'b4', dueAt: '2026-12-01T10:00:00.000Z' }),
    loan({ id: 'l5', bookId: 'b5', dueAt: '2026-11-01T10:00:00.000Z', overdue: true }),
  ];
  await stubLists(page, { books, readers: [reader], loans });
  await page.goto('/v2/');

  const table = page.getByRole('table', { name: 'Выдачи' });
  // Вторая группа строк — тело таблицы, первая — шапка
  const rows = table.getByRole('rowgroup').nth(1).getByRole('row');
  await expect(rows).toHaveCount(5);
  await expect(rows.nth(0)).toContainText('Книга-просрочена-давно');
  await expect(rows.nth(1)).toContainText('Книга-просрочена-поздно');
  await expect(rows.nth(2)).toContainText('Книга-срок-скоро');
  await expect(rows.nth(3)).toContainText('Книга-срок-поздно');
  await expect(rows.nth(4)).toContainText('Книга-вернули');

  // Статус виден текстом и цветом; просроченная строка выделена целиком
  await expect(rows.nth(0)).toContainText('Просрочена');
  await expect(rows.nth(0)).toHaveCSS('background-color', 'rgb(254, 240, 217)');
  await expect(rows.nth(0).getByRole('cell', { name: 'Просрочена', exact: true })).toHaveCSS(
    'color',
    'rgb(122, 65, 0)',
  );
  await expect(rows.nth(1)).toHaveCSS('background-color', 'rgb(254, 240, 217)');
  await expect(rows.nth(2)).toContainText('На руках');
  await expect(rows.nth(2)).not.toHaveCSS('background-color', 'rgb(254, 240, 217)');
  await expect(rows.nth(4)).toContainText('Возвращена 10.11.2026');
  await expect(
    rows.nth(4).getByRole('cell', { name: 'Возвращена 10.11.2026', exact: true }),
  ).toHaveCSS('color', 'rgb(63, 82, 68)');

  // «Вернуть» только у активных выдач
  await expect(rows.nth(0).getByRole('button', { name: 'Вернуть' })).toBeVisible();
  await expect(rows.nth(4).getByRole('button', { name: 'Вернуть' })).toHaveCount(0);
});
