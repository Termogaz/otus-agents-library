import { expect, test, type Page } from '@playwright/test';

// Прототип /prototype/: демо-данные в памяти браузера, ни одного запроса к /api (D-10).

test.use({ viewport: { width: 1280, height: 800 } });

const BOOK = 'Демо-книга «Первая»';
const SINGLE_BOOK = 'Демо-книга «Единственная»';
const READER = 'Демо-читатель Второй';

// Считает запросы к /api и прерывает их: прототип обязан обходиться без сервера
async function countApiRequests(page: Page): Promise<() => number> {
  let count = 0;
  await page.route('**/api/**', async (route) => {
    count += 1;
    await route.abort();
  });
  return () => count;
}

// Открывает состояние макета по хешу; счётчик запросов к /api ставится до перехода
async function openScenario(page: Page, hash: string): Promise<() => number> {
  const apiRequests = await countApiRequests(page);
  await page.goto(`/prototype/#${hash}`);
  return apiRequests;
}

function regions(page: Page) {
  return {
    loans: page.getByRole('region', { name: 'Выдачи', exact: true }),
    books: page.getByRole('region', { name: 'Книги', exact: true }),
    readers: page.getByRole('region', { name: 'Читатели', exact: true }),
  };
}

// Выбор книги и читателя в форме выдачи и нажатие «Выдать»
async function checkout(page: Page, book: string, reader: string) {
  const { loans } = regions(page);
  await loans.getByLabel('Книга').selectOption({ label: book });
  await loans.getByLabel('Читатель').selectOption({ label: reader });
  await loans.getByRole('button', { name: 'Выдать' }).click();
}

test('opens prototype without any API request', async ({ page }) => {
  const apiRequests = await countApiRequests(page);
  await page.goto('/prototype/');

  const table = page.getByRole('table', { name: 'Выдачи' });
  await expect(table).toBeVisible();
  await expect(table.getByRole('row', { name: /Демо-/ }).first()).toBeVisible();
  await expect(page.getByText('API: демо-данные')).toBeVisible();
  expect(apiRequests()).toBe(0);
});

test('shows work state with demo tables and no alert', async ({ page }) => {
  const apiRequests = await openScenario(page, 'work');

  const { loans, books, readers } = regions(page);
  await expect(loans.getByRole('table', { name: 'Выдачи' })).toContainText('Демо-');
  await expect(books.getByRole('table', { name: 'Книги' })).toContainText('Демо-');
  await expect(readers.getByRole('table', { name: 'Читатели' })).toContainText('Демо-');
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(apiRequests()).toBe(0);
});

test('shows first launch state with empty catalog texts', async ({ page }) => {
  const apiRequests = await openScenario(page, 'first');

  await expect(page.getByText('Каталог пуст. Добавьте первую книгу.')).toBeVisible();
  await expect(
    page.getByText('Чтобы выдать книгу, сначала добавьте книгу и читателя ниже.'),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(apiRequests()).toBe(0);
});

test('shows failed state with one alert at the top', async ({ page }) => {
  const apiRequests = await openScenario(page, 'failed');

  const { loans } = regions(page);
  const alert = page.getByRole('alert');
  await expect(alert).toHaveCount(1);
  await expect(loans.getByText('Данные не загружены')).toBeVisible();
  const alertBox = await alert.boundingBox();
  const loansBox = await loans.boundingBox();
  expect(alertBox && loansBox && alertBox.y < loansBox.y).toBe(true);
  expect(apiRequests()).toBe(0);
});

test('shows waiting state with a disabled button and the same label', async ({ page }) => {
  const apiRequests = await openScenario(page, 'waiting');

  await checkout(page, BOOK, READER);

  const button = regions(page).loans.getByRole('button', { name: 'Выдать' });
  await expect(button).toBeDisabled();
  await expect(button).toHaveText('Выдать');
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(apiRequests()).toBe(0);
});

test('shows saved state without a list refresh and without an alert', async ({ page }) => {
  const apiRequests = await openScenario(page, 'saved');

  await checkout(page, BOOK, READER);

  await expect(regions(page).loans.getByRole('status')).toHaveText(
    'Сохранено, но список не обновился. Обновите страницу',
  );
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(apiRequests()).toBe(0);
});

test('shows issued state with title, reader and due date', async ({ page }) => {
  const apiRequests = await openScenario(page, 'issued');

  await checkout(page, BOOK, READER);

  await expect(regions(page).loans.getByRole('status')).toHaveText(
    new RegExp(`^Выдано: «${BOOK}», ${READER}\\. Срок: \\d\\d\\.\\d\\d\\.\\d{4}$`),
  );
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(apiRequests()).toBe(0);
});

test('shows refusal state in the loans region with a single alert', async ({ page }) => {
  const apiRequests = await openScenario(page, 'refusal');

  await checkout(page, SINGLE_BOOK, READER);

  await expect(regions(page).loans.getByRole('alert')).toHaveText('Нет свободных экземпляров');
  await expect(page.getByRole('alert')).toHaveCount(1);
  expect(apiRequests()).toBe(0);
});

test('shows returned state with the accepted status in focus', async ({ page }) => {
  const apiRequests = await openScenario(page, 'returned');

  const { loans } = regions(page);
  const table = loans.getByRole('table', { name: 'Выдачи' });
  await table.getByRole('row', { name: BOOK }).getByRole('button', { name: 'Вернуть' }).click();

  const status = loans.getByRole('status');
  await expect(status).toHaveText('Принято: «Демо-книга «Первая»», Демо-читатель Третий');
  await expect(status).toBeFocused();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(apiRequests()).toBe(0);
});

test('switches state through the panel links without a page reload', async ({ page }) => {
  const apiRequests = await openScenario(page, 'work');

  const panel = page.getByRole('navigation', { name: 'Состояния прототипа' });
  await expect(panel.getByRole('link')).toHaveCount(8);
  await expect(panel.getByRole('link', { name: 'Работа' })).toHaveAttribute('aria-current', 'page');
  // Метка живёт в окне до перехода: после перезагрузки страницы её бы не было
  await page.evaluate(() => {
    (window as unknown as { reloadMarker: boolean }).reloadMarker = true;
  });

  await panel.getByRole('link', { name: 'Первый запуск' }).click();

  await expect(page).toHaveURL(/#first$/);
  await expect(panel.getByRole('link', { name: 'Первый запуск' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(panel.getByRole('link', { name: 'Работа' })).not.toHaveAttribute('aria-current');
  await expect(page.getByText('Каталог пуст. Добавьте первую книгу.')).toBeVisible();
  expect(await page.evaluate(() => 'reloadMarker' in window)).toBe(true);
  expect(apiRequests()).toBe(0);
});

test('completes main scenario on demo data', async ({ page }) => {
  const apiRequests = await openScenario(page, 'first');
  const title = 'Демо-книга сценария';
  const name = 'Демо-читатель сценария';

  const { loans, books, readers } = regions(page);
  const bookForm = books.getByRole('form', { name: 'Добавить книгу' });
  await bookForm.getByLabel('Название').fill(title);
  await bookForm.getByLabel('Автор').fill('Демо-автор сценария');
  await bookForm.getByLabel('ISBN').fill('000-0-00-000099-0');
  await bookForm.getByLabel('Экземпляров').fill('1');
  await bookForm.getByRole('button', { name: 'Добавить' }).click();
  await expect(books.getByRole('status')).toHaveText(`Книга «${title}» добавлена`);

  const readerForm = readers.getByRole('form', { name: 'Добавить читателя' });
  await readerForm.getByLabel('Имя').fill(name);
  await readerForm.getByLabel('Контакт').fill('demo-scenario@example.test');
  await readerForm.getByRole('button', { name: 'Добавить' }).click();
  await expect(readers.getByRole('status')).toHaveText(`Читатель ${name} добавлен`);

  await checkout(page, title, name);
  await expect(loans.getByRole('status')).toHaveText(
    new RegExp(`^Выдано: «${title}», ${name}\\. Срок: \\d\\d\\.\\d\\d\\.\\d{4}$`),
  );

  const table = loans.getByRole('table', { name: 'Выдачи' });
  await table.getByRole('row', { name: title }).getByRole('button', { name: 'Вернуть' }).click();
  await expect(loans.getByRole('status')).toHaveText(`Принято: «${title}», ${name}`);
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(apiRequests()).toBe(0);
});

// Снимки восьми состояний для README «Модуль 4»: копии лежат в docs/screenshots/hw4-prototype-*.png.
// Каталог test-results вне git. Перед снимком каждая строка таблиц содержит «Демо-» (T-07-19).
test('saves screenshots of eight states', async ({ page }) => {
  const apiRequests = await countApiRequests(page);
  const { loans } = regions(page);

  // Состояние готово к снимку: сообщение полностью проявилось, строки таблиц только демо
  async function shoot(name: string) {
    for (const message of await page.getByRole('alert').all()) {
      await expect(message).toHaveCSS('opacity', '1');
    }
    for (const message of await loans.getByRole('status').all()) {
      await expect(message).toHaveCSS('opacity', '1');
    }
    const rows = page.getByRole('row').filter({ hasNot: page.getByRole('columnheader') });
    for (const row of await rows.all()) {
      await expect(row).toContainText('Демо-');
    }
    await page.screenshot({ path: `test-results/hw4/prototype-${name}.png`, fullPage: true });
  }

  // Состояние открыто, когда ссылка панели с его подписью стала текущей
  async function open(name: string, label: string) {
    await page.goto(`/prototype/#${name}`);
    await expect(page.getByRole('link', { name: label, exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
  }

  await open('work', 'Работа');
  await expect(loans.getByRole('table', { name: 'Выдачи' })).toBeVisible();
  await shoot('work');

  await open('first', 'Первый запуск');
  await expect(page.getByText('Каталог пуст. Добавьте первую книгу.')).toBeVisible();
  await shoot('first');

  await open('failed', 'Сбой загрузки');
  await expect(page.getByRole('alert')).toHaveCount(1);
  await shoot('failed');

  await open('waiting', 'Ожидание ответа');
  await checkout(page, BOOK, READER);
  await expect(loans.getByRole('button', { name: 'Выдать' })).toBeDisabled();
  await shoot('waiting');

  await open('saved', 'Сохранено без списка');
  await checkout(page, BOOK, READER);
  await expect(loans.getByRole('status')).toHaveText(/^Сохранено, но список не обновился/);
  await shoot('saved');

  await open('issued', 'Выдано');
  await checkout(page, BOOK, READER);
  await expect(loans.getByRole('status')).toContainText('Выдано:');
  await shoot('issued');

  await open('refusal', 'Отказ');
  await checkout(page, SINGLE_BOOK, READER);
  await expect(loans.getByRole('alert')).toHaveText('Нет свободных экземпляров');
  await shoot('refusal');

  await open('returned', 'Возвращено');
  const table = loans.getByRole('table', { name: 'Выдачи' });
  await table.getByRole('row', { name: BOOK }).getByRole('button', { name: 'Вернуть' }).click();
  await expect(loans.getByRole('status')).toContainText('Принято:');
  await shoot('returned');

  expect(apiRequests()).toBe(0);
});
