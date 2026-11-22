import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';

// Отказы API на /v2/ (D-12): 403, сетевой сбой и истёкшая сессия объяснены по-русски.
test.use({ viewport: { width: 1280, height: 800 } });

async function createBook(request: APIRequestContext, title: string): Promise<void> {
  const response = await request.post('/api/books', {
    data: { title, author: 'Автор E2E', isbn: randomUUID(), copies: 1 },
  });
  expect(response.ok()).toBe(true);
}

async function createReader(request: APIRequestContext, name: string): Promise<void> {
  const response = await request.post('/api/readers', {
    data: { name, contact: 'reader@example.com' },
  });
  expect(response.ok()).toBe(true);
}

test('explains a forbidden action', async ({ page }) => {
  await page.route('**/api/books', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    return route.fulfill({ status: 403, json: { code: 'FORBIDDEN' } });
  });
  await page.goto('/v2/');

  const books = page.getByRole('region', { name: 'Книги', exact: true });
  await books.getByLabel('Название').fill('Книга без прав');
  await books.getByLabel('Автор').fill('Автор');
  await books.getByLabel('ISBN').fill('978-5-17-090631-9');
  await books.getByRole('button', { name: 'Добавить' }).click();

  await expect(books.getByRole('alert')).toHaveText('У вас нет прав на это действие');
});

test('explains a network failure during an action', async ({ page, request }) => {
  const tag = randomUUID().slice(0, 8);
  const title = `Сетевая книга ${tag}`;
  const name = `Сетевой читатель ${tag}`;
  await createBook(request, title);
  await createReader(request, name);
  await page.route('**/api/loans', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    return route.abort();
  });
  await page.goto('/v2/');

  const loans = page.getByRole('region', { name: 'Выдачи', exact: true });
  await loans.getByLabel('Книга').selectOption({ label: title });
  await loans.getByLabel('Читатель').selectOption({ label: name });
  await loans.getByRole('button', { name: 'Выдать' }).click();

  await expect(loans.getByRole('alert')).toHaveText('Сервер недоступен');
});

test('sends to the login page when the session expires', async ({ page }) => {
  await page.goto('/v2/');
  await expect(page.getByRole('region', { name: 'Книги', exact: true })).toBeVisible();

  // Сессия «истекла» после загрузки: перечитывание выдач после записи получает 401
  await page.route('**/api/loans', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({ status: 401, json: { code: 'UNAUTHENTICATED' } });
  });
  const books = page.getByRole('region', { name: 'Книги', exact: true });
  await books.getByLabel('Название').fill(`Книга сессии ${randomUUID().slice(0, 8)}`);
  await books.getByLabel('Автор').fill('Автор');
  await books.getByLabel('ISBN').fill('978-5-17-090631-9');
  await books.getByRole('button', { name: 'Добавить' }).click();

  await expect(page).toHaveURL(/\/login\/\?next=%2Fv2%2F$/);
});
