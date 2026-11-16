import { expect, test, type Page } from '@playwright/test';

// Снимки MVP (/v2/) и прежнего интерфейса для README «Модуль 4».
// Каталог test-results вне git; копии лежат в docs/screenshots/hw4-v2-*.png и hw4-old-links.png.
// Тест создаёт свои демо-записи через API и показывает на страницах только их: GET-запросы списков
// пропускают записи с id, полученными при создании. Поэтому он проходит на любом файле данных, а
// в кадр не попадают настоящие данные (T-07-21). Перед каждым снимком все строки таблиц содержат
// «Демо-» и контакты оканчиваются на @example.test.

const OUT = 'test-results/hw4/final';
const BOOK_ONE = 'Демо-книга «Путь к реке»';
const BOOK_TWO = 'Демо-книга «Тихий порт»';
const SINGLE_BOOK = 'Демо-единственный экземпляр';
const READER_ONE = 'Демо-читатель Аня';
const READER_TWO = 'Демо-читатель Борис';

// Все строки тел таблиц страницы содержат «Демо-»
async function expectOnlyDemoRows(page: Page) {
  const rows = page.getByRole('row').filter({ hasNot: page.getByRole('columnheader') });
  for (const row of await rows.all()) {
    await expect(row).toContainText('Демо-');
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

async function shoot(page: Page, name: string, fullPage: boolean) {
  await expectMessagesSettled(page);
  await expectOnlyDemoRows(page);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
}

// Создаёт запись через API и запоминает её id
async function create(
  page: Page,
  url: string,
  data: Record<string, string | number>,
  ids: Set<string>,
) {
  const response = await page.request.post(url, { data });
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  ids.add(id);
}

test('saves screenshots of v2 and links in the old interface', async ({ page }) => {
  const bookIds = new Set<string>();
  const readerIds = new Set<string>();

  const books = [
    { title: BOOK_ONE, author: 'Демо-автор Иванов', isbn: '978-0-00-000001-1', copies: 3 },
    { title: BOOK_TWO, author: 'Демо-автор Петрова', isbn: '978-0-00-000002-8', copies: 2 },
    { title: SINGLE_BOOK, author: 'Демо-автор Сидоров', isbn: '978-0-00-000003-5', copies: 1 },
  ];
  for (const book of books) await create(page, '/api/books', book, bookIds);
  await create(page, '/api/readers', { name: READER_ONE, contact: 'anya@example.test' }, readerIds);
  await create(
    page,
    '/api/readers',
    { name: READER_TWO, contact: 'boris@example.test' },
    readerIds,
  );

  await page.route('**/api/books', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const response = await route.fetch();
    const all = (await response.json()) as { id: string }[];
    return route.fulfill({ json: all.filter((book) => bookIds.has(book.id)) });
  });
  await page.route('**/api/readers', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const response = await route.fetch();
    const all = (await response.json()) as { id: string }[];
    return route.fulfill({ json: all.filter((reader) => readerIds.has(reader.id)) });
  });
  await page.route('**/api/loans', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const response = await route.fetch();
    const all = (await response.json()) as { bookId: string }[];
    return route.fulfill({ json: all.filter((loan) => bookIds.has(loan.bookId)) });
  });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/v2/');

  const loans = page.getByRole('region', { name: 'Выдачи', exact: true });
  const loansTable = loans.getByRole('table', { name: 'Выдачи' });

  async function checkout(book: string, reader: string) {
    await loans.getByLabel('Книга').selectOption({ label: book });
    await loans.getByLabel('Читатель').selectOption({ label: reader });
    await loans.getByRole('button', { name: 'Выдать' }).click();
  }

  // Работа: одна выдача; страница открыта заново, без сообщений действий
  await expect(page.getByRole('table', { name: 'Книги' })).toContainText(BOOK_ONE);
  await checkout(BOOK_ONE, READER_ONE);
  await expect(loans.getByRole('status')).toContainText('Выдано:');
  await page.goto('/v2/');
  const workRow = loansTable.getByRole('row', { name: BOOK_ONE });
  await expect(workRow).toBeVisible();
  await expect(workRow).toHaveCSS('opacity', '1');
  await shoot(page, 'hw4-v2-work', true);

  // Выдано: подтверждение с названием, читателем и сроком
  await checkout(BOOK_TWO, READER_TWO);
  await expect(loans.getByRole('status')).toContainText(`Выдано: «${BOOK_TWO}», ${READER_TWO}`);
  await shoot(page, 'hw4-v2-issued', true);

  // Отказ: единственный экземпляр уже на руках
  await checkout(SINGLE_BOOK, READER_ONE);
  await expect(loans.getByRole('status')).toContainText(`Выдано: «${SINGLE_BOOK}»`);
  await checkout(SINGLE_BOOK, READER_TWO);
  await expect(loans.getByRole('alert')).toHaveText('Нет свободных экземпляров');
  await shoot(page, 'hw4-v2-refusal', false);

  // Узкий экран: вся страница в 375 px
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/v2/');
  const narrowRow = loansTable.getByRole('row', { name: BOOK_ONE });
  await expect(narrowRow).toBeVisible();
  await expect(narrowRow).toHaveCSS('opacity', '1');
  await shoot(page, 'hw4-v2-narrow-375', true);

  // Прежний интерфейс: подвал со ссылками на варианты (D-01, D-03)
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.getByText('API: ok')).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Варианты интерфейса' });
  await nav.scrollIntoViewIfNeeded();
  await expect(nav.getByRole('link', { name: 'MVP' })).toBeVisible();
  await shoot(page, 'hw4-old-links', false);
});
