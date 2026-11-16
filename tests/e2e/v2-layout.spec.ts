import { expect, test, type Page } from '@playwright/test';
import type { BookView, LoanView, ReaderView } from '../../src/client/api';
import { createGate, stubLists } from './fake-api';

// Раскладка и палитра страницы /v2/ (NFR-1, NFR-2, DESIGN.md). Данные подменяются через stubLists,
// длинные названия без пробелов проверяют худший случай ширины.

const LONG_TITLE = 'Очень-длинное-название-книги-без-единого-пробела-для-проверки-ширины';
const LONG_NAME = 'Константинопольский-Константин-Константинович';

// Токены DESIGN.md в виде, в котором их возвращает браузер
const COLOR = {
  accent: 'rgb(16, 73, 17)',
  surfaceMuted: 'rgb(168, 213, 226)',
  surface: 'rgb(255, 255, 255)',
  text: 'rgb(28, 43, 29)',
  textMuted: 'rgb(63, 82, 68)',
  danger: 'rgb(122, 65, 0)',
  dangerBg: 'rgb(254, 240, 217)',
  disabledBg: 'rgb(228, 235, 230)',
};

const books: BookView[] = [
  {
    id: 'b1',
    title: LONG_TITLE,
    author: 'М. Булгаков',
    isbn: '978-5-17-090631-9',
    copies: 3,
    available: 1,
  },
  {
    id: 'b2',
    title: 'Анна Каренина',
    author: 'Л. Толстой',
    isbn: '978-5-17-090631-0',
    copies: 2,
    available: 2,
  },
  {
    id: 'b3',
    title: 'Тихий Дон',
    author: 'М. Шолохов',
    isbn: '978-5-17-090631-1',
    copies: 1,
    available: 1,
  },
];

const readers: ReaderView[] = [
  { id: 'r1', name: LONG_NAME, contact: 'long-address-for-width-check@example.com' },
  { id: 'r2', name: 'Борис Иванов', contact: 'boris@example.com' },
];

const loans: LoanView[] = [
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
    readerId: 'r2',
    issuedAt: '2026-11-01T10:00:00.000Z',
    dueAt: '2026-12-10T10:00:00.000Z',
    returnedAt: null,
    overdue: false,
  },
  {
    id: 'l3',
    bookId: 'b3',
    readerId: 'r2',
    issuedAt: '2026-10-05T10:00:00.000Z',
    dueAt: '2026-11-05T10:00:00.000Z',
    returnedAt: '2026-11-10T10:00:00.000Z',
    overdue: false,
  },
];

async function open(page: Page, width: number, height = 900): Promise<void> {
  await page.setViewportSize({ width, height });
  await stubLists(page, { books, readers, loans });
  await page.goto('/v2/');
  await expect(page.getByRole('table', { name: 'Выдачи' })).toBeVisible();
}

function loansTable(page: Page) {
  return page.getByRole('table', { name: 'Выдачи' });
}

// Строки тела: первая группа — шапка, вторая — тело
function loanRows(page: Page) {
  return loansTable(page).getByRole('rowgroup').nth(1).getByRole('row');
}

function region(page: Page, name: string) {
  return page.getByRole('region', { name, exact: true });
}

async function box(locator: ReturnType<Page['locator']>) {
  const rect = await locator.boundingBox();
  if (!rect) throw new Error('элемент не имеет размеров');
  return rect;
}

test('has no page horizontal scroll from 360 to 1440 px', async ({ page }) => {
  for (const width of [360, 390, 1440]) {
    await open(page, width);
    const overflow = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      inner: window.innerWidth,
    }));
    expect(overflow.scroll, `страница ${width} px`).toBeLessThanOrEqual(overflow.inner);
  }

  // Широкая таблица прокручивается в своём блоке
  await open(page, 360);
  const scroller = await region(page, 'Таблица выдач').evaluate((el) => ({
    scroll: el.scrollWidth,
    client: el.clientWidth,
  }));
  expect(scroller.scroll).toBeGreaterThan(scroller.client);
});

test('places loans full width and books to readers as 5 to 3', async ({ page }) => {
  await open(page, 1280, 1000);
  const loansBox = await box(region(page, 'Выдачи'));
  const booksBox = await box(region(page, 'Книги'));
  const readersBox = await box(region(page, 'Читатели'));

  expect(loansBox.y).toBeLessThan(booksBox.y);
  // «Выдачи» занимают обе колонки целиком
  expect(loansBox.width).toBeGreaterThan(booksBox.width + readersBox.width);
  expect(loansBox.x).toBeCloseTo(booksBox.x, 0);
  expect(booksBox.y).toBeCloseTo(readersBox.y, 1);
  expect(booksBox.width / readersBox.width).toBeCloseTo(5 / 3, 1);

  // Ниже 768 px разделы идут столбцом
  await open(page, 390);
  const narrowLoans = await box(region(page, 'Выдачи'));
  const narrowBooks = await box(region(page, 'Книги'));
  const narrowReaders = await box(region(page, 'Читатели'));
  expect(narrowBooks.y).toBeGreaterThan(narrowLoans.y + narrowLoans.height - 1);
  expect(narrowReaders.y).toBeGreaterThan(narrowBooks.y + narrowBooks.height - 1);
  expect(narrowBooks.x).toBeCloseTo(narrowReaders.x, 0);
});

test('keeps status and return visible on narrow screen', async ({ page }) => {
  await open(page, 390);
  const table = loansTable(page);

  // Видимый порядок колонок: Книга, Статус, Действие, Читатель, Вернуть до (D-14)
  const order = ['Книга', 'Статус', 'Действие', 'Читатель', 'Вернуть до'];
  const xs: number[] = [];
  for (const name of order) {
    xs.push((await box(table.getByRole('columnheader', { name, exact: true }))).x);
  }
  for (let i = 1; i < xs.length; i += 1) {
    expect(xs[i], `${order[i]} правее ${order[i - 1]}`).toBeGreaterThan(xs[i - 1] ?? 0);
  }

  // Статус и «Вернуть» просроченной строки целиком внутри блока при нулевой прокрутке
  const scroller = region(page, 'Таблица выдач');
  expect(await scroller.evaluate((el) => el.scrollLeft)).toBe(0);
  const right = (await box(scroller)).x + (await box(scroller)).width;
  const row = table.getByRole('row', { name: LONG_TITLE });
  const status = await box(row.getByRole('cell', { name: 'Просрочена', exact: true }));
  const action = await box(row.getByRole('button', { name: 'Вернуть' }));
  expect(status.x + status.width).toBeLessThanOrEqual(right + 0.5);
  expect(action.x + action.width).toBeLessThanOrEqual(right + 0.5);

  // На широком экране порядок как в разметке
  await open(page, 1280);
  const wide = ['Книга', 'Читатель', 'Выдана', 'Вернуть до', 'Статус', 'Действие'];
  const wideXs: number[] = [];
  for (const name of wide) {
    wideXs.push((await box(loansTable(page).getByRole('columnheader', { name, exact: true }))).x);
  }
  for (let i = 1; i < wideXs.length; i += 1) {
    expect(wideXs[i], `${wide[i]} правее ${wide[i - 1]}`).toBeGreaterThan(wideXs[i - 1] ?? 0);
  }
});

test('uses DESIGN.md colors', async ({ page }) => {
  await open(page, 1280, 1000);
  const table = loansTable(page);

  await expect(
    region(page, 'Выдачи').getByRole('button', { name: 'Выдать', exact: true }),
  ).toHaveCSS('background-color', COLOR.accent);
  await expect(table.getByRole('rowgroup').first()).toHaveCSS(
    'background-color',
    COLOR.surfaceMuted,
  );
  await expect(region(page, 'Книги')).toHaveCSS('background-color', COLOR.surface);

  const rows = loanRows(page);
  // Просроченная строка первая: все её ячейки на danger-bg, статус danger
  const overdueCells = rows.nth(0).getByRole('cell');
  await expect(overdueCells).toHaveCount(6);
  for (let i = 0; i < 6; i += 1) {
    await expect(overdueCells.nth(i)).toHaveCSS('background-color', COLOR.dangerBg);
  }
  const overdueStatus = rows.nth(0).getByRole('cell', { name: 'Просрочена', exact: true });
  await expect(overdueStatus).toHaveText('Просрочена');
  await expect(overdueStatus).toHaveCSS('color', COLOR.danger);
  await expect(rows.nth(0).getByRole('cell').first()).toHaveCSS('color', COLOR.text);

  // «На руках» — обычный текст, не зелёный и не оранжевый (D-07)
  await expect(rows.nth(1).getByRole('cell', { name: 'На руках', exact: true })).toHaveCSS(
    'color',
    COLOR.text,
  );
  await expect(rows.nth(1)).toHaveCSS('background-color', COLOR.surface);

  // «Возвращена ДД.ММ.ГГГГ» — приглушённый текст
  await expect(
    rows.nth(2).getByRole('cell', { name: /^Возвращена \d{2}\.\d{2}\.\d{4}$/ }),
  ).toHaveCSS('color', COLOR.textMuted);
});

test('keeps table rows at least 44 px high', async ({ page }) => {
  for (const width of [1280, 390]) {
    await open(page, width);
    const rows = loanRows(page);
    await expect(rows).toHaveCount(3);
    for (let i = 0; i < 3; i += 1) {
      expect((await box(rows.nth(i))).height, `строка ${i} при ${width} px`).toBeGreaterThanOrEqual(
        44,
      );
    }
  }
  await open(page, 1280);
  const booksRows = region(page, 'Книги').getByRole('rowgroup').nth(1).getByRole('row');
  for (let i = 0; i < 3; i += 1) {
    expect((await box(booksRows.nth(i))).height).toBeGreaterThanOrEqual(44);
  }
});

test('shows keyboard focus outline', async ({ page }) => {
  await open(page, 1280);
  await page.keyboard.press('Tab');
  const select = page.getByLabel('Книга', { exact: true });
  await expect(select).toBeFocused();
  await expect(select).toHaveCSS('outline-style', 'solid');
  await expect(select).toHaveCSS('outline-width', '2px');
  await expect(select).toHaveCSS('outline-color', COLOR.accent);
});

test('greys out locked return button', async ({ page }) => {
  await open(page, 1280);
  const gate = createGate();
  await page.route('**/api/loans/*/return', async (route) => {
    await gate.opened;
    await route.fulfill({ json: {} });
  });

  const button = loanRows(page).nth(1).getByRole('button', { name: 'Вернуть' });
  await expect(button).toHaveCSS('background-color', COLOR.surface);
  await button.click();
  await expect(button).toBeDisabled();
  await expect(button).toHaveCSS('background-color', COLOR.disabledBg);
  // Текст кнопки при блокировке не меняется
  await expect(button).toHaveText('Вернуть');
  gate.open();
  await expect(page.getByRole('status')).toBeVisible();
});
