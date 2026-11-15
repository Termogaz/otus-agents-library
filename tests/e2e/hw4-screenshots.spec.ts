import { expect, test, type Page } from '@playwright/test';

// Снимки MVP (/v2/) и прежнего интерфейса для README «Модуль 4».
// Каталог test-results вне git; копии лежат в docs/screenshots/hw4-v2-*.png и hw4-old-links.png.
// Запускать только на копии data/seed.json (T-07-21): перед каждым снимком все строки таблиц
// книг, читателей и выдач содержат «Демо-», то есть в кадр попадают только данные seed и этого теста.

const OUT = 'test-results/hw4/final';
const SINGLE_BOOK = 'Демо-единственный экземпляр';
const BOOK_ONE = 'Демо-книга «Путь к реке»';
const BOOK_TWO = 'Демо-книга «Тихий порт»';
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

test('saves screenshots of v2 and links in the old interface', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/v2/');

  const loans = page.getByRole('region', { name: 'Выдачи', exact: true });
  const books = page.getByRole('region', { name: 'Книги', exact: true });
  const loansTable = loans.getByRole('table', { name: 'Выдачи' });

  async function checkout(book: string, reader: string) {
    await loans.getByLabel('Книга').selectOption({ label: book });
    await loans.getByLabel('Читатель').selectOption({ label: reader });
    await loans.getByRole('button', { name: 'Выдать' }).click();
  }

  // Работа: одна выдача из seed-данных; страница открыта заново, без сообщений действий
  await expect(books.getByRole('table', { name: 'Книги' })).toContainText('Демо-');
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
  const bookForm = books.getByRole('form', { name: 'Добавить книгу' });
  await bookForm.getByLabel('Название').fill(SINGLE_BOOK);
  await bookForm.getByLabel('Автор').fill('Демо-автор');
  await bookForm.getByLabel('ISBN').fill('978-0-00-000098-4');
  await bookForm.getByLabel('Экземпляров').fill('1');
  await bookForm.getByRole('button', { name: 'Добавить' }).click();
  await expect(books.getByRole('status')).toHaveText(`Книга «${SINGLE_BOOK}» добавлена`);

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
