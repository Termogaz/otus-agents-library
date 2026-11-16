import { expect, test, type Page } from '@playwright/test';
import type { BookView, LoanView, ReaderView } from '../../src/client/api';
import { stubLists } from './fake-api';

// Подсказки у формы выдачи на /v2/ (FR-6): числа из загруженных данных, решение остаётся за сервером.

test.use({ viewport: { width: 1280, height: 800 } });

const books: BookView[] = [
  {
    id: 'b1',
    title: 'Бесы',
    author: 'Ф. Достоевский',
    isbn: '978-5-17-000000-1',
    copies: 2,
    available: 1,
  },
  {
    id: 'b2',
    title: 'Идиот',
    author: 'Ф. Достоевский',
    isbn: '978-5-17-000000-2',
    copies: 1,
    available: 0,
  },
];

const readers: ReaderView[] = [
  { id: 'r1', name: 'Анна Петрова', contact: 'anna@example.com' },
  { id: 'r2', name: 'Борис Иванов', contact: 'boris@example.com' },
];

function loan(id: string, bookId: string, readerId: string, returnedAt: string | null): LoanView {
  return {
    id,
    bookId,
    readerId,
    issuedAt: '2026-11-01T10:00:00.000Z',
    dueAt: '2026-12-10T10:00:00.000Z',
    returnedAt,
    overdue: false,
  };
}

// У Анны две активные выдачи и одна возвращённая: в подсказку идут только активные
const loans: LoanView[] = [
  loan('l1', 'b1', 'r1', null),
  loan('l2', 'b2', 'r1', null),
  loan('l3', 'b1', 'r1', '2026-11-05T10:00:00.000Z'),
];

async function openPage(page: Page) {
  await stubLists(page, { books, readers, loans });
  await page.goto('/v2/');
  const section = page.getByRole('region', { name: 'Выдачи', exact: true });
  await expect(section.getByRole('option', { name: 'Бесы' })).toBeAttached();
  return {
    section,
    book: section.getByLabel('Книга'),
    reader: section.getByLabel('Читатель'),
    submit: section.getByRole('button', { name: 'Выдать' }),
  };
}

test('shows no hints before a book and a reader are chosen', async ({ page }) => {
  const { book, reader } = await openPage(page);

  await expect(book).toHaveAccessibleDescription('');
  await expect(reader).toHaveAccessibleDescription('');
});

test('shows free copies and active loans after choosing', async ({ page }) => {
  const { book, reader } = await openPage(page);

  await book.selectOption({ label: 'Бесы' });
  await reader.selectOption({ label: 'Анна Петрова' });

  await expect(book).toHaveAccessibleDescription('Свободно: 1 из 2');
  await expect(reader).toHaveAccessibleDescription('На руках: 2');

  await reader.selectOption({ label: 'Борис Иванов' });
  await expect(reader).toHaveAccessibleDescription('На руках: 0');
});

test('keeps the checkout button enabled when no copies are free', async ({ page }) => {
  const { section, book, reader, submit } = await openPage(page);

  await book.selectOption({ label: 'Идиот' });
  await reader.selectOption({ label: 'Анна Петрова' });

  await expect(book).toHaveAccessibleDescription('Свободно: 0 из 1');
  await expect(submit).toBeEnabled();
  // Лимит книг на читателя в подсказках не показан: его знает только сервер
  await expect(section.getByText('из 3')).toHaveCount(0);
});

test('keeps hints free of live roles and does not move the button', async ({ page }) => {
  const { section, book, reader, submit } = await openPage(page);

  const before = await submit.boundingBox();
  await book.selectOption({ label: 'Бесы' });
  await reader.selectOption({ label: 'Анна Петрова' });
  await expect(book).toHaveAccessibleDescription('Свободно: 1 из 2');
  const after = await submit.boundingBox();

  // Строка под полем зарезервирована заранее: кнопка не прыгает
  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  expect(after!.y).toBe(before!.y);

  await expect(section.getByRole('alert')).toHaveCount(0);
  await expect(section.getByRole('status')).toHaveCount(0);
});

test('offers placeholder options and chooses a book by exact title', async ({ page }) => {
  const { book, reader } = await openPage(page);

  await expect(book.getByRole('option').first()).toHaveText('Выберите книгу');
  await expect(reader.getByRole('option').first()).toHaveText('Выберите читателя');
  await expect(book.getByRole('option', { name: 'Бесы', exact: true })).toHaveText('Бесы');
  await expect(reader.getByRole('option', { name: 'Анна Петрова', exact: true })).toHaveText(
    'Анна Петрова',
  );
});
