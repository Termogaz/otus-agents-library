import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

// «Заполнить из текста» на /v2/ (D-14): черновик от AI заполняет форму книги, сохраняет библиотекарь.
// Ответы AI подменены через page.route: в DeepSeek тесты не ходят.
test.use({ viewport: { width: 1280, height: 800 } });

async function askDraft(page: Page, text: string) {
  await page.goto('/v2/');
  const books = page.getByRole('region', { name: 'Книги', exact: true });
  await books.getByRole('button', { name: 'Заполнить из текста', exact: true }).click();
  await books.getByLabel('Описание книги').fill(text);
  await books.getByRole('button', { name: 'Заполнить', exact: true }).click();
  return books;
}

test('fills the book form from free text', async ({ page }) => {
  const tag = randomUUID().slice(0, 8);
  const draft = {
    title: `Книга от AI ${tag}`,
    author: 'Автор от AI',
    isbn: `978-${tag}`,
    copies: 3,
  };
  let requestedText: unknown;
  await page.route('**/api/ai/book-draft', async (route) => {
    requestedText = (route.request().postDataJSON() as { text?: unknown }).text;
    return route.fulfill({ status: 200, json: draft });
  });

  const books = await askDraft(page, 'Книга про AI, автор, 3 экземпляра');

  const form = books.getByRole('form', { name: 'Добавить книгу' });
  await expect(form.getByLabel('Название')).toHaveValue(draft.title);
  await expect(form.getByLabel('Автор')).toHaveValue(draft.author);
  await expect(form.getByLabel('ISBN')).toHaveValue(draft.isbn);
  await expect(form.getByLabel('Экземпляров')).toHaveValue('3');
  expect(requestedText).toBe('Книга про AI, автор, 3 экземпляра');
  // Черновик не сохранён: книги в списке нет, пока библиотекарь не нажал «Добавить»
  await expect(books.getByRole('cell', { name: draft.title })).toHaveCount(0);

  await form.getByRole('button', { name: 'Добавить' }).click();

  await expect(books.getByRole('status')).toHaveText(`Книга «${draft.title}» добавлена`);
  await expect(books.getByRole('cell', { name: draft.title })).toBeVisible();
});

test('explains that the assistant is disabled', async ({ page }) => {
  await page.route('**/api/ai/book-draft', (route) =>
    route.fulfill({ status: 503, json: { code: 'AI_DISABLED' } }),
  );

  const books = await askDraft(page, 'Любая книга');

  await expect(books.getByRole('alert')).toHaveText('Подсказки AI отключены');
});

test('explains the daily limit', async ({ page }) => {
  await page.route('**/api/ai/book-draft', (route) =>
    route.fulfill({ status: 429, json: { code: 'AI_LIMIT_REACHED' } }),
  );

  const books = await askDraft(page, 'Любая книга');

  await expect(books.getByRole('alert')).toHaveText('Дневной лимит подсказок AI исчерпан');
});
