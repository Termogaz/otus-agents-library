import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';

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
