import { expect, test, type Page } from '@playwright/test';
import { stubLists } from './fake-api';

// Ссылки между тремя вариантами интерфейса: /, /v2/, /prototype/ (D-03)

const TITLE = {
  legacy: 'Библиотека',
  v2: 'Библиотека, вариант 2',
  prototype: 'Библиотека, прототип',
};

// Данные снимков: одна просроченная выдача и одна активная
const SNAPSHOT_DATA = {
  books: [
    {
      id: 'b1',
      title: 'Мастер и Маргарита',
      author: 'М. Булгаков',
      isbn: '978-5-17-090631-9',
      copies: 2,
      available: 1,
    },
    {
      id: 'b2',
      title: 'Анна Каренина',
      author: 'Л. Толстой',
      isbn: '978-5-17-090631-0',
      copies: 1,
      available: 0,
    },
  ],
  readers: [{ id: 'r1', name: 'Анна Петрова', contact: 'anna@example.com' }],
  loans: [
    {
      id: 'l1',
      bookId: 'b1',
      readerId: 'r1',
      issuedAt: '2026-10-01T10:00:00.000Z',
      dueAt: '2026-10-20T10:00:00.000Z',
      returnedAt: null,
      overdue: true,
    },
    {
      id: 'l2',
      bookId: 'b2',
      readerId: 'r1',
      issuedAt: '2026-11-01T10:00:00.000Z',
      dueAt: '2026-12-10T10:00:00.000Z',
      returnedAt: null,
      overdue: false,
    },
  ],
};

function variantNav(page: Page) {
  return page.getByRole('navigation', { name: 'Варианты интерфейса' });
}

test('links from old interface to v2 and prototype', async ({ page }) => {
  await page.goto('/');
  await variantNav(page).getByRole('link', { name: 'MVP' }).click();
  await expect(page).toHaveURL(/\/v2\/$/);
  await expect(page).toHaveTitle(TITLE.v2);

  await page.goto('/');
  await variantNav(page).getByRole('link', { name: 'Прототип' }).click();
  await expect(page).toHaveURL(/\/prototype\/$/);
  await expect(page).toHaveTitle(TITLE.prototype);
});

test('links from v2 to old interface and prototype', async ({ page }) => {
  await stubLists(page, SNAPSHOT_DATA);
  await page.goto('/v2/');
  await variantNav(page).getByRole('link', { name: 'Прежний интерфейс' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page).toHaveTitle(TITLE.legacy);

  await page.goto('/v2/');
  await variantNav(page).getByRole('link', { name: 'Прототип' }).click();
  await expect(page).toHaveURL(/\/prototype\/$/);
  await expect(page).toHaveTitle(TITLE.prototype);

  // Снимки страниц для проверяющего: каталог вне git
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/v2/');
    const row = page
      .getByRole('table', { name: 'Выдачи' })
      .getByRole('row', { name: /Мастер и Маргарита/ });
    await expect(row).toBeVisible();
    await expect(row).toHaveCSS('opacity', '1');
    await page.screenshot({ path: `test-results/hw4/v2-${width}.png`, fullPage: true });
  }
});

test('links from prototype to old interface and v2', async ({ page }) => {
  await page.goto('/prototype/');
  await variantNav(page).getByRole('link', { name: 'Прежний интерфейс' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page).toHaveTitle(TITLE.legacy);

  await page.goto('/prototype/');
  await variantNav(page).getByRole('link', { name: 'MVP' }).click();
  await expect(page).toHaveURL(/\/v2\/$/);
  await expect(page).toHaveTitle(TITLE.v2);
});

test('marks current variant', async ({ page }) => {
  await stubLists(page, { books: [], readers: [], loans: [] });
  await page.goto('/v2/');
  await expect(variantNav(page).getByRole('link', { name: 'MVP' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(variantNav(page).getByRole('link', { name: 'Прототип' })).not.toHaveAttribute(
    'aria-current',
    'page',
  );

  await page.goto('/prototype/');
  await expect(variantNav(page).getByRole('link', { name: 'Прототип' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(variantNav(page).getByRole('link', { name: 'MVP' })).not.toHaveAttribute(
    'aria-current',
    'page',
  );
});
