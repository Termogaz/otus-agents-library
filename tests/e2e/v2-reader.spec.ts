import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { accounts } from '../fixtures/accounts';

// «Мои книги» на /v2/ у читателя (D-12): каталог и свои выдачи, без форм записи.
// Данные создаёт библиотекарь через API; фильтр чужих выдач делает RLS на сервере (D-06).
test.use({ storageState: 'playwright/.auth/reader.json' });

type Created = { id: string; dueAt?: string };

async function post(api: APIRequestContext, path: string, data: unknown): Promise<Created> {
  const res = await api.post(path, { data });
  expect(res.ok()).toBe(true);
  return (await res.json()) as Created;
}

async function createBook(api: APIRequestContext, title: string): Promise<Created> {
  return post(api, '/api/books', { title, author: 'Автор E2E', isbn: randomUUID(), copies: 3 });
}

// ДД.ММ.ГГГГ по локальной дате, как показывает интерфейс
function ddmmyyyy(iso: string): string {
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${date.getFullYear()}`;
}

test.describe('with data from the librarian', () => {
  let librarian: APIRequestContext;

  test.beforeEach(async ({ playwright, baseURL }) => {
    librarian = await playwright.request.newContext({
      baseURL,
      storageState: 'playwright/.auth/librarian.json',
    });
  });

  test.afterEach(async () => {
    await librarian.dispose();
  });

  test('shows the catalog and own loans to a reader', async ({ page }) => {
    const title = `Книга читателя ${randomUUID().slice(0, 8)}`;
    const book = await createBook(librarian, title);
    const loan = await post(librarian, '/api/loans', {
      bookId: book.id,
      readerId: accounts.reader.readerId,
    });

    await page.goto('/v2/');

    await expect(page.getByRole('heading', { name: 'Мои книги' })).toBeVisible();
    const catalog = page.getByRole('table', { name: 'Каталог' });
    await expect(catalog.getByRole('row', { name: new RegExp(title) })).toContainText('2 из 3');
    const own = page.getByRole('table', { name: 'Мои выдачи' });
    const row = own.getByRole('row', { name: new RegExp(title) });
    await expect(row).toContainText(ddmmyyyy(loan.dueAt ?? ''));
    await expect(row).toContainText('На руках');
  });

  test('does not show loans of other readers', async ({ page }) => {
    const title = `Чужая книга ${randomUUID().slice(0, 8)}`;
    const book = await createBook(librarian, title);
    const other = await post(librarian, '/api/readers', {
      name: `Другой читатель ${randomUUID().slice(0, 8)}`,
      contact: 'other@example.com',
    });
    await post(librarian, '/api/loans', { bookId: book.id, readerId: other.id });

    await page.goto('/v2/');

    const catalog = page.getByRole('table', { name: 'Каталог' });
    await expect(catalog.getByRole('row', { name: new RegExp(title) })).toBeVisible();
    // Название есть только в каталоге: в «Моих выдачах» чужой выдачи нет
    await expect(page.getByText(title)).toHaveCount(1);
  });
});

test('hides write forms from a reader', async ({ page }) => {
  await page.goto('/v2/');

  await expect(page.getByRole('heading', { name: 'Мои книги' })).toBeVisible();
  for (const name of ['Добавить книгу', 'Добавить читателя', 'Выдать', 'Вернуть']) {
    await expect(page.getByRole('button', { name })).toHaveCount(0);
  }
  await expect(page.getByRole('form')).toHaveCount(0);
});
