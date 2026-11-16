import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { createGate } from './fake-api';

// Блокировка кнопки на время запроса (FR-3): двойной клик не должен слать второй запрос.
// Ответы сервера удерживаются воротами, паузы по времени не используются.

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

function regions(page: Page) {
  return {
    loans: page.getByRole('region', { name: 'Выдачи', exact: true }),
    books: page.getByRole('region', { name: 'Книги', exact: true }),
  };
}

test('sends one request when the add book button is double clicked', async ({ page }) => {
  const title = `Идиот ${randomUUID().slice(0, 8)}`;
  const gate = createGate();
  let posts = 0;
  await page.goto('/v2/');
  await page.route('**/api/books', async (route) => {
    if (route.request().method() === 'POST') {
      posts += 1;
      await gate.opened;
    }
    await route.continue();
  });

  const { books } = regions(page);
  const form = books.getByRole('form', { name: 'Добавить книгу' });
  await form.getByLabel('Название').fill(title);
  await form.getByLabel('Автор').fill('Ф. Достоевский');
  await form.getByLabel('ISBN').fill('978-5-17-000000-1');
  await form.getByRole('button', { name: 'Добавить' }).dblclick();
  gate.open();

  await expect(books.getByRole('status')).toHaveText(`Книга «${title}» добавлена`);
  expect(posts).toBe(1);
  await expect(
    books.getByRole('table', { name: 'Книги' }).getByRole('row', { name: title }),
  ).toHaveCount(1);
});

test('sends one request when the checkout button is double clicked', async ({ page, request }) => {
  const tag = randomUUID().slice(0, 8);
  const title = `Мастер и Маргарита ${tag}`;
  const name = `Анна ${tag}`;
  await createBook(request, title, 3);
  await createReader(request, name);
  const gate = createGate();
  let posts = 0;
  await page.goto('/v2/');
  await page.route('**/api/loans', async (route) => {
    if (route.request().method() === 'POST') {
      posts += 1;
      await gate.opened;
    }
    await route.continue();
  });

  const { loans } = regions(page);
  await loans.getByLabel('Книга').selectOption({ label: title });
  await loans.getByLabel('Читатель').selectOption({ label: name });
  await loans.getByRole('button', { name: 'Выдать' }).dblclick();
  gate.open();

  await expect(loans.getByRole('status')).toContainText('Выдано:');
  expect(posts).toBe(1);
  await expect(loans.getByRole('alert')).toHaveCount(0);
});

test('sends one request when the return button is double clicked and keeps the neighbour enabled', async ({
  page,
  request,
}) => {
  const tag = randomUUID().slice(0, 8);
  const firstTitle = `Мастер и Маргарита ${tag}`;
  const secondTitle = `Идиот ${tag}`;
  const reader = await createReader(request, `Анна ${tag}`);
  const firstBook = await createBook(request, firstTitle, 1);
  const secondBook = await createBook(request, secondTitle, 1);
  await createLoan(request, firstBook.id, reader.id);
  await createLoan(request, secondBook.id, reader.id);
  const gate = createGate();
  let posts = 0;
  await page.goto('/v2/');
  await page.route('**/api/loans/*/return', async (route) => {
    posts += 1;
    await gate.opened;
    await route.continue();
  });

  const { loans } = regions(page);
  const table = loans.getByRole('table', { name: 'Выдачи' });
  const first = table
    .getByRole('row', { name: firstTitle })
    .getByRole('button', { name: 'Вернуть' });
  const second = table
    .getByRole('row', { name: secondTitle })
    .getByRole('button', { name: 'Вернуть' });
  await first.dblclick();

  await expect(first).toBeDisabled();
  await expect(second).toBeEnabled();
  gate.open();

  await expect(loans.getByRole('status')).toHaveText(`Принято: «${firstTitle}», Анна ${tag}`);
  expect(posts).toBe(1);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByText('Книга уже возвращена')).toHaveCount(0);
});

test('keeps the button blocked until the list refresh finishes and then returns focus', async ({
  page,
}) => {
  const title = `Бесы ${randomUUID().slice(0, 8)}`;
  const listGate = createGate();
  let posted = false;
  await page.goto('/v2/');
  await page.route('**/api/books', async (route) => {
    if (route.request().method() === 'POST') {
      posted = true;
    } else if (posted) {
      // Список после записи удерживается: кнопка должна оставаться заблокированной
      await listGate.opened;
    }
    await route.continue();
  });

  const { books } = regions(page);
  const form = books.getByRole('form', { name: 'Добавить книгу' });
  await form.getByLabel('Название').fill(title);
  await form.getByLabel('Автор').fill('Ф. Достоевский');
  await form.getByLabel('ISBN').fill('978-5-17-000000-2');
  const button = form.getByRole('button', { name: 'Добавить' });
  await button.click();

  await expect(button).toBeDisabled();
  // Текст кнопки не меняется на время запроса
  await expect(button).toHaveText('Добавить');
  listGate.open();

  await expect(button).toBeEnabled();
  await expect(books.getByRole('status')).toHaveText(`Книга «${title}» добавлена`);
  await expect(form.getByLabel('Название')).toBeFocused();
});

test('sends a request again after the checkout outcome so the button never stays locked', async ({
  page,
  request,
}) => {
  const tag = randomUUID().slice(0, 8);
  const title = `Мастер и Маргарита ${tag}`;
  const name = `Анна ${tag}`;
  await createBook(request, title, 1);
  await createReader(request, name);
  await page.goto('/v2/');

  const { loans } = regions(page);
  await loans.getByLabel('Книга').selectOption({ label: title });
  await loans.getByLabel('Читатель').selectOption({ label: name });
  const button = loans.getByRole('button', { name: 'Выдать' });
  await button.click();
  await expect(loans.getByRole('status')).toContainText('Выдано:');
  await expect(button).toBeEnabled();

  // Единственный экземпляр выдан: повторный клик уходит на сервер и получает отказ
  await button.click();
  await expect(loans.getByRole('alert')).toHaveText('Нет свободных экземпляров');
  await expect(button).toBeFocused();
});
