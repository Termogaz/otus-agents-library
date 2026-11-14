import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

// Итоги действий на странице /v2/ (FR-2, FR-5): настоящий сервер, данные с уникальной меткой.

test.use({ viewport: { width: 1280, height: 800 } });

type Created = { id: string };

async function createBook(request: APIRequestContext, title: string, copies: number) {
  const response = await request.post('/api/books', {
    data: { title, author: 'М. Булгаков', isbn: '978-5-17-090631-9', copies },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as Created;
}

async function createReader(request: APIRequestContext, name: string) {
  const response = await request.post('/api/readers', {
    data: { name, contact: 'reader@example.com' },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as Created;
}

async function createLoan(request: APIRequestContext, bookId: string, readerId: string) {
  const response = await request.post('/api/loans', { data: { bookId, readerId } });
  expect(response.ok()).toBe(true);
  return (await response.json()) as Created;
}

test('shows checkout refusal under the button without scrolling at 1280x800', async ({
  page,
  request,
}) => {
  const tag = randomUUID().slice(0, 8);
  const title = `Мастер и Маргарита ${tag}`;
  const first = `Анна ${tag}`;
  const second = `Борис ${tag}`;

  const book = await createBook(request, title, 1);
  const firstReader = await createReader(request, first);
  await createReader(request, second);
  // Единственный экземпляр занят: вторая выдача получит отказ сервера
  await createLoan(request, book.id, firstReader.id);

  // Список выдач дополнен копиями записи, чтобы страница стала выше окна
  await page.route('**/api/loans', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const loans = (await response.json()) as Record<string, unknown>[];
    const sample = loans[0];
    const extra = sample
      ? Array.from({ length: 40 }, (_, index) => ({ ...sample, id: `extra-${tag}-${index}` }))
      : [];
    await route.fulfill({ response, json: [...loans, ...extra] });
  });

  await page.goto('/v2/');

  const loans = page.getByRole('region', { name: 'Выдачи', exact: true });
  await loans.getByLabel('Книга').selectOption({ label: title });
  await loans.getByLabel('Читатель').selectOption({ label: second });
  await loans.getByRole('button', { name: 'Выдать' }).click();

  const alert = loans.getByRole('alert');
  await expect(alert).toHaveText('Нет свободных экземпляров');
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(800);
  await expect(alert).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

const SAVED_TEXT = 'Сохранено, но список не обновился. Обновите страницу';

function regions(page: Page) {
  return {
    loans: page.getByRole('region', { name: 'Выдачи', exact: true }),
    books: page.getByRole('region', { name: 'Книги', exact: true }),
    readers: page.getByRole('region', { name: 'Читатели', exact: true }),
  };
}

// Книга с одним экземпляром, читатель и (по желанию) выдача с уникальной меткой
async function seed(request: APIRequestContext, tag: string, withLoan: boolean) {
  const title = `Мастер и Маргарита ${tag}`;
  const name = `Анна ${tag}`;
  const book = await createBook(request, title, 1);
  const reader = await createReader(request, name);
  if (withLoan) await createLoan(request, book.id, reader.id);
  return { title, name, book, reader };
}

test('shows book added status, clears the form and focuses the first field', async ({ page }) => {
  const title = `Идиот ${randomUUID().slice(0, 8)}`;
  await page.goto('/v2/');

  const { books } = regions(page);
  const form = books.getByRole('form', { name: 'Добавить книгу' });
  await form.getByLabel('Название').fill(title);
  await form.getByLabel('Автор').fill('Ф. Достоевский');
  await form.getByLabel('ISBN').fill('978-5-17-000000-1');
  await form.getByLabel('Экземпляров').fill('2');
  await form.getByRole('button', { name: 'Добавить' }).click();

  await expect(books.getByRole('status')).toHaveText(`Книга «${title}» добавлена`);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(form.getByLabel('Название')).toHaveValue('');
  await expect(form.getByLabel('Автор')).toHaveValue('');
  await expect(form.getByLabel('ISBN')).toHaveValue('');
  await expect(form.getByLabel('Название')).toBeFocused();
  await expect(
    books.getByRole('table', { name: 'Таблица книг' }).getByRole('row', { name: title }),
  ).toContainText('2 из 2');
});

test('shows reader added status, clears the form and focuses the first field', async ({ page }) => {
  const name = `Пётр ${randomUUID().slice(0, 8)}`;
  await page.goto('/v2/');

  const { readers } = regions(page);
  const form = readers.getByRole('form', { name: 'Добавить читателя' });
  await form.getByLabel('Имя').fill(name);
  await form.getByLabel('Контакт').fill('petr@example.com');
  await form.getByRole('button', { name: 'Добавить' }).click();

  await expect(readers.getByRole('status')).toHaveText(`Читатель ${name} добавлен`);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(form.getByLabel('Имя')).toHaveValue('');
  await expect(form.getByLabel('Контакт')).toHaveValue('');
  await expect(form.getByLabel('Имя')).toBeFocused();
});

test('shows checkout status with title, reader and due date and keeps the selection', async ({
  page,
  request,
}) => {
  const { title, name, book, reader } = await seed(request, randomUUID().slice(0, 8), false);
  await page.goto('/v2/');

  const { loans } = regions(page);
  await loans.getByLabel('Книга').selectOption({ label: title });
  await loans.getByLabel('Читатель').selectOption({ label: name });
  await loans.getByRole('button', { name: 'Выдать' }).click();

  await expect(loans.getByRole('status')).toHaveText(
    new RegExp(`^Выдано: «${title}», ${name}\\. Срок: \\d\\d\\.\\d\\d\\.\\d{4}$`),
  );
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(loans.getByLabel('Книга')).toHaveValue(book.id);
  await expect(loans.getByLabel('Читатель')).toHaveValue(reader.id);
  await expect(loans.getByRole('button', { name: 'Выдать' })).toBeFocused();
});

test('shows return status above the table and moves focus to it', async ({ page, request }) => {
  const { title, name } = await seed(request, randomUUID().slice(0, 8), true);
  await page.goto('/v2/');

  const { loans } = regions(page);
  const table = loans.getByRole('table', { name: 'Таблица выдач' });
  await table.getByRole('row', { name: title }).getByRole('button', { name: 'Вернуть' }).click();

  const status = loans.getByRole('status');
  await expect(status).toHaveText(`Принято: «${title}», ${name}`);
  await expect(status).toBeFocused();
  await expect(status).toBeInViewport();
  const statusBox = await status.boundingBox();
  const tableBox = await table.boundingBox();
  expect(statusBox && tableBox && statusBox.y < tableBox.y).toBe(true);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('shows saved status instead of a refusal when the list refresh fails', async ({ page }) => {
  const title = `Преступление и наказание ${randomUUID().slice(0, 8)}`;
  await page.goto('/v2/');
  const { books } = regions(page);
  const form = books.getByRole('form', { name: 'Добавить книгу' });
  await expect(form.getByLabel('Название')).toBeVisible();

  // Действие проходит, а следующее чтение списков обрывается
  await page.route(/\/api\/(books|readers|loans)$/, async (route) => {
    if (route.request().method() === 'GET') await route.abort();
    else await route.continue();
  });

  await form.getByLabel('Название').fill(title);
  await form.getByLabel('Автор').fill('Ф. Достоевский');
  await form.getByLabel('ISBN').fill('978-5-17-000000-2');
  await form.getByRole('button', { name: 'Добавить' }).click();

  await expect(books.getByRole('status')).toHaveText(SAVED_TEXT);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(form.getByLabel('Название')).toHaveValue('');
});

test('replaces the refusal with the next success so no alert stays', async ({ page, request }) => {
  const tag = randomUUID().slice(0, 8);
  const { title } = await seed(request, tag, true);
  const second = await createReader(request, `Борис ${tag}`);
  await page.goto('/v2/');

  const { loans, books } = regions(page);
  await loans.getByLabel('Книга').selectOption({ label: title });
  await loans.getByLabel('Читатель').selectOption({ value: second.id });
  await loans.getByRole('button', { name: 'Выдать' }).click();
  await expect(page.getByRole('alert')).toHaveCount(1);
  await expect(loans.getByRole('alert')).toHaveText('Нет свободных экземпляров');

  const form = books.getByRole('form', { name: 'Добавить книгу' });
  await form.getByLabel('Название').fill(`Бесы ${tag}`);
  await form.getByLabel('Автор').fill('Ф. Достоевский');
  await form.getByLabel('ISBN').fill('978-5-17-000000-3');
  await form.getByRole('button', { name: 'Добавить' }).click();

  await expect(books.getByRole('status')).toHaveText(`Книга «Бесы ${tag}» добавлена`);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('shows return refusal above the table', async ({ page, request }) => {
  const { title } = await seed(request, randomUUID().slice(0, 8), true);
  await page.route('**/api/loans/*/return', async (route) => {
    await route.fulfill({ status: 409, json: { code: 'LOAN_ALREADY_RETURNED' } });
  });
  await page.goto('/v2/');

  const { loans } = regions(page);
  const table = loans.getByRole('table', { name: 'Таблица выдач' });
  await table.getByRole('row', { name: title }).getByRole('button', { name: 'Вернуть' }).click();

  const alert = loans.getByRole('alert');
  await expect(alert).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(1);
  const alertBox = await alert.boundingBox();
  const tableBox = await table.boundingBox();
  expect(alertBox && tableBox && alertBox.y < tableBox.y).toBe(true);
});

test('keeps the status on the page without a timer', async ({ page, request }) => {
  const { title, name } = await seed(request, randomUUID().slice(0, 8), false);
  await page.clock.install();
  await page.goto('/v2/');

  const { loans } = regions(page);
  await loans.getByLabel('Книга').selectOption({ label: title });
  await loans.getByLabel('Читатель').selectOption({ label: name });
  await loans.getByRole('button', { name: 'Выдать' }).click();
  await expect(loans.getByRole('status')).toContainText('Выдано:');

  await page.clock.fastForward('10:00');
  await expect(loans.getByRole('status')).toContainText('Выдано:');
});
