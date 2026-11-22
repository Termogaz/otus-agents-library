import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { accounts } from '../fixtures/accounts';

// Снимки ДЗ-5 для README «Модуль 5»: вход, вид читателя, черновик книги от AI.
// Каталог test-results вне git; копии лежат в docs/screenshots/hw5-*.png.
// В кадр попадают только демо-записи: GET-списки пропускают записи «Демо-…», а в тесте
// входа используется несуществующий логин «demo-user», пароль на снимке не виден (T-08-46).
// ВАЖНО: снимок hw5-ai-draft сделан с ПОДМЕНЁННЫМ ответом модели (page.route на
// POST /api/ai/book-draft), это не живой вызов DeepSeek (T-08-47).

const OUT = 'test-results/hw5/final';
const DEMO = 'Демо-';
const ANONYMOUS = { cookies: [], origins: [] };

test.use({ viewport: { width: 1280, height: 800 } });

// Все строки тел таблиц страницы содержат «Демо-»
async function expectOnlyDemoRows(page: Page) {
  const rows = page.getByRole('row').filter({ hasNot: page.getByRole('columnheader') });
  for (const row of await rows.all()) {
    await expect(row).toContainText(DEMO);
  }
}

// Итоги действий полностью проявились (анимация появления закончена)
async function expectMessagesSettled(page: Page) {
  for (const message of await page.getByRole('alert').all()) {
    await expect(message).toHaveCSS('opacity', '1');
  }
  for (const message of await page.getByRole('status').all()) {
    await expect(message).toHaveCSS('opacity', '1');
  }
}

async function shoot(page: Page, name: string) {
  await expectMessagesSettled(page);
  await expectOnlyDemoRows(page);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

type Created = { id: string };

async function create(
  api: APIRequestContext,
  url: string,
  data: Record<string, string | number>,
): Promise<string> {
  const response = await api.post(url, { data });
  expect(response.status()).toBe(201);
  return ((await response.json()) as Created).id;
}

// Оставляет в ответе GET только записи, для которых keep вернул true
async function filterList<T>(page: Page, url: string, keep: (item: T) => boolean) {
  await page.route(url, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const response = await route.fetch();
    const all = (await response.json()) as T[];
    return route.fulfill({ json: all.filter(keep) });
  });
}

test.describe('anonymous visitor', () => {
  test.use({ storageState: ANONYMOUS });

  test('saves a screenshot of the login page with an error', async ({ page }) => {
    await page.goto('/login/');
    await page.getByLabel('Логин').fill('demo-user');
    await page.getByLabel('Пароль').fill('wrong-password-value');
    await page.getByRole('button', { name: 'Войти' }).click();

    await expect(page.getByRole('alert')).toHaveText('Неверный логин или пароль');
    await expect(page.getByLabel('Пароль')).toHaveValue('');
    await shoot(page, 'hw5-login');
  });
});

test.describe('reader', () => {
  test.use({ storageState: 'playwright/.auth/reader.json' });

  test('saves a screenshot of the reader view with one loan', async ({
    page,
    playwright,
    baseURL,
  }) => {
    const tag = randomUUID().slice(0, 8);
    const librarian = await playwright.request.newContext({
      baseURL,
      storageState: 'playwright/.auth/librarian.json',
    });
    const bookIds = new Set<string>();
    try {
      const books = [
        { title: `${DEMO}книга «Путь к реке» ${tag}`, author: 'Демо-автор Иванов', copies: 3 },
        { title: `${DEMO}книга «Тихий порт» ${tag}`, author: 'Демо-автор Петрова', copies: 2 },
      ];
      for (const [index, book] of books.entries()) {
        bookIds.add(
          await create(librarian, '/api/books', {
            ...book,
            isbn: `978-0-00-${tag}-${index}`,
          }),
        );
      }
      const [firstBookId] = [...bookIds];
      await create(librarian, '/api/loans', {
        bookId: firstBookId ?? '',
        readerId: accounts.reader.readerId,
      });
    } finally {
      await librarian.dispose();
    }

    await filterList<{ id: string }>(page, '**/api/books', (book) => bookIds.has(book.id));
    await filterList<{ bookId: string }>(page, '**/api/loans', (loan) => bookIds.has(loan.bookId));

    await page.goto('/v2/');

    await expect(page.getByRole('heading', { name: 'Мои книги' })).toBeVisible();
    const own = page.getByRole('table', { name: 'Мои выдачи' });
    await expect(
      own.getByRole('row', { name: new RegExp(`${DEMO}книга «Путь к реке»`) }),
    ).toContainText('На руках');
    await expect(
      page.getByRole('table', { name: 'Каталог' }).getByRole('row', { name: /Тихий порт/ }),
    ).toContainText('2 из 2');
    await shoot(page, 'hw5-reader');
  });
});

test.describe('librarian', () => {
  test('saves a screenshot of the book form filled from a mocked AI draft', async ({
    page,
    request,
  }) => {
    const tag = randomUUID().slice(0, 8);
    const bookIds = new Set<string>();
    bookIds.add(
      await create(request, '/api/books', {
        title: `${DEMO}книга «Тихий порт» ${tag}`,
        author: 'Демо-автор Петрова',
        isbn: `978-0-00-${tag}-1`,
        copies: 2,
      }),
    );
    const readerIds = new Set<string>();
    readerIds.add(
      await create(request, '/api/readers', {
        name: `${DEMO}читатель Аня ${tag}`,
        contact: 'anya@example.test',
      }),
    );

    await filterList<{ id: string }>(page, '**/api/books', (book) => bookIds.has(book.id));
    await filterList<{ id: string }>(page, '**/api/readers', (reader) => readerIds.has(reader.id));
    await filterList<{ bookId: string }>(page, '**/api/loans', (loan) => bookIds.has(loan.bookId));

    // Ответ модели подменён: в DeepSeek тест не ходит
    const draft = {
      title: `${DEMO}книга «Река времени» ${tag}`,
      author: 'Демо-автор Сидоров',
      isbn: `978-0-00-${tag}-9`,
      copies: 3,
    };
    await page.route('**/api/ai/book-draft', (route) =>
      route.fulfill({ status: 200, json: draft }),
    );

    await page.goto('/v2/');
    const books = page.getByRole('region', { name: 'Книги', exact: true });
    await expect(
      books.getByRole('cell', { name: new RegExp(`Тихий порт.* ${tag}`) }),
    ).toBeVisible();
    await books.getByRole('button', { name: 'Заполнить из текста', exact: true }).click();
    await books
      .getByLabel('Описание книги')
      .fill('Демо-автор Сидоров, «Река времени», три экземпляра');
    await books.getByRole('button', { name: 'Заполнить', exact: true }).click();

    const form = books.getByRole('form', { name: 'Добавить книгу' });
    await expect(form.getByLabel('Название')).toHaveValue(draft.title);
    await expect(form.getByLabel('Автор')).toHaveValue(draft.author);
    await expect(form.getByLabel('ISBN')).toHaveValue(draft.isbn);
    await expect(form.getByLabel('Экземпляров')).toHaveValue('3');
    await shoot(page, 'hw5-ai-draft');
  });
});
