import { expect, test } from '@playwright/test';
import type { BookView, LoanView, ReaderView } from '../../src/client/api';
import { createGate, stubLists } from './fake-api';

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

test('shows loading text without empty texts during first load', async ({ page }) => {
  const gate = createGate();
  // Три GET удерживаются воротами: пока они закрыты, страница видит первую загрузку
  for (const pattern of ['**/api/books', '**/api/readers', '**/api/loans']) {
    await page.route(pattern, async (route) => {
      if (route.request().method() === 'GET') await gate.opened;
      await route.fallback();
    });
  }
  await page.goto('/v2/');

  await expect(page.getByText('Загрузка…', { exact: true })).toHaveCount(3);
  await expect(page.getByText('Каталог пуст', { exact: false })).toHaveCount(0);
  await expect(page.getByText('Читателей пока нет', { exact: false })).toHaveCount(0);
  await expect(page.getByText('Выдач пока нет', { exact: false })).toHaveCount(0);
  await expect(page.getByText('Чтобы выдать книгу', { exact: false })).toHaveCount(0);
  await expect(page.getByText('Данные не загружены')).toHaveCount(0);
  // Формы доступны и во время загрузки (Э-5)
  await expect(page.getByRole('button', { name: 'Выдать' })).toBeEnabled();

  gate.open();
  await expect(page.getByText('Загрузка…', { exact: true })).toHaveCount(0);
  await expect(page.getByText('API: ok')).toBeVisible();
});

const emptyCases: { name: string; books: BookView[]; readers: ReaderView[]; text: string }[] = [
  {
    name: 'there are no books and no readers',
    books: [],
    readers: [],
    text: 'Чтобы выдать книгу, сначала добавьте книгу и читателя ниже.',
  },
  {
    name: 'there are no books',
    books: [],
    readers: [reader],
    text: 'Чтобы выдать книгу, сначала добавьте её в каталог ниже.',
  },
  {
    name: 'there are no readers',
    books: [book('b1', 'Мастер и Маргарита')],
    readers: [],
    text: 'Чтобы выдать книгу, сначала добавьте читателя ниже.',
  },
  {
    name: 'books and readers exist but there are no loans',
    books: [book('b1', 'Мастер и Маргарита')],
    readers: [reader],
    text: 'Выдач пока нет. Выберите книгу и читателя выше.',
  },
];

for (const item of emptyCases) {
  test(`shows loans empty text when ${item.name}`, async ({ page }) => {
    await stubLists(page, { books: item.books, readers: item.readers, loans: [] });
    await page.goto('/v2/');

    await expect(page.getByText(item.text, { exact: true })).toBeVisible();
    await expect(page.getByText('Загрузка…')).toHaveCount(0);
    await expect(page.getByRole('table', { name: 'Выдачи' })).toHaveCount(0);
    // Тексты пустых списков не живые: ни alert, ни status
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('status')).toHaveCount(0);
  });
}

test('shows empty texts for books and readers after a successful load', async ({ page }) => {
  await stubLists(page, { books: [], readers: [], loans: [] });
  await page.goto('/v2/');

  await expect(
    page.getByText('Каталог пуст. Добавьте первую книгу.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Читателей пока нет. Добавьте первого читателя.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
});

test('shows load failure at the top', async ({ page }) => {
  for (const pattern of ['**/api/books', '**/api/readers', '**/api/loans']) {
    await page.route(pattern, async (route) => {
      if (route.request().method() === 'GET') {
        await route.abort();
      } else {
        await route.fallback();
      }
    });
  }
  await page.goto('/v2/');

  const alert = page.getByRole('alert');
  await expect(alert).toHaveCount(1);
  await expect(alert).toHaveText('Сервер недоступен');
  // Сообщение выше первого раздела
  const alertBox = await alert.boundingBox();
  const loansBox = await page.getByRole('region', { name: 'Выдачи', exact: true }).boundingBox();
  expect(alertBox).not.toBeNull();
  expect(loansBox).not.toBeNull();
  expect(alertBox!.y).toBeLessThan(loansBox!.y);

  await expect(page.getByText('Данные не загружены', { exact: true })).toHaveCount(3);
  await expect(page.getByText('API: недоступен')).toBeVisible();
  await expect(page.getByText('Каталог пуст', { exact: false })).toHaveCount(0);
  await expect(page.getByText('Читателей пока нет', { exact: false })).toHaveCount(0);
  await expect(page.getByText('Выдач пока нет', { exact: false })).toHaveCount(0);
  await expect(page.getByText('Загрузка…')).toHaveCount(0);
  // Формы остаются активными
  await expect(page.getByRole('button', { name: 'Выдать' })).toBeEnabled();
});

test('shows readers as a table', async ({ page }) => {
  const readers: ReaderView[] = [
    reader,
    { id: 'r2', name: 'Борис Иванов', contact: 'boris@example.com' },
  ];
  await stubLists(page, { books: [], readers, loans: [] });
  await page.goto('/v2/');

  const table = page.getByRole('table', { name: 'Читатели' });
  await expect(table.getByRole('columnheader')).toHaveText(['Имя', 'Контакт']);
  const rows = table.getByRole('rowgroup').nth(1).getByRole('row');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).getByRole('cell')).toHaveText(['Анна Петрова', 'anna@example.com']);
  await expect(rows.nth(1).getByRole('cell')).toHaveText(['Борис Иванов', 'boris@example.com']);
  await expect(page.getByRole('region', { name: 'Таблица читателей' })).toBeVisible();
  await expect(page.getByText('Читателей пока нет')).toHaveCount(0);
});
