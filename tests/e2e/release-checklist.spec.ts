import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

// Чек-лист перед показом (D-13). Пути страниц относительные: один файл работает с
// playwright.config.ts (dev-сервер), с playwright.docker.config.ts (контейнеры) и с публичной
// ссылкой через E2E_BASE_URL. Каждый тест Playwright открывает в новом контексте браузера без
// истории, кэша и cookie — это и есть проверка «инкогнито».
// Шрифты Google Fonts по умолчанию прерываются и ошибкой не считаются; с E2E_REAL_FONT=1
// фильтра нет и недоступный шрифт будет виден как ошибка.

const REAL_FONT = process.env['E2E_REAL_FONT'] === '1';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

function isFontUrl(url: string): boolean {
  if (url === '') return false;
  try {
    return FONT_HOSTS.includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

interface Problems {
  console: string[];
  responses: string[];
}

// Собирает ошибки консоли, исключения страницы и ответы с кодом от 400
async function watchProblems(page: Page): Promise<Problems> {
  const problems: Problems = { console: [], responses: [] };

  if (!REAL_FONT) {
    await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.abort());
  }

  page.on('console', (message: ConsoleMessage) => {
    if (message.type() !== 'error') return;
    const url = message.location().url;
    if (!REAL_FONT && isFontUrl(url)) return;
    problems.console.push(`${url || 'без адреса'}: ${message.text()}`);
  });
  page.on('pageerror', (error) => {
    problems.console.push(`исключение страницы: ${error.message}`);
  });
  page.on('response', (response) => {
    if (response.status() < 400) return;
    if (!REAL_FONT && isFontUrl(response.url())) return;
    problems.responses.push(`${response.status()} ${response.url()}`);
  });

  return problems;
}

const PAGES = [
  { path: '/', title: 'Библиотека', apiStatus: 'API: ok', narrow: false },
  { path: '/v2/', title: 'Библиотека, вариант 2', apiStatus: 'API: ok', narrow: true },
  {
    path: '/prototype/',
    title: 'Библиотека, прототип',
    apiStatus: 'API: демо-данные',
    narrow: true,
  },
];

for (const { path, title, apiStatus } of PAGES) {
  test(`has expected title and no console errors or failed responses on ${path}`, async ({
    page,
  }) => {
    const problems = await watchProblems(page);
    await page.goto(path);

    await expect(
      page.getByRole('heading', { level: 1, name: 'Библиотека', exact: true }),
    ).toBeVisible();
    await expect(page.getByText(apiStatus)).toBeVisible();
    await expect(page).toHaveTitle(title);

    expect(problems.console, `ошибки консоли:\n${problems.console.join('\n')}`).toEqual([]);
    expect(
      problems.responses,
      `ответы с кодом 400 и выше:\n${problems.responses.join('\n')}`,
    ).toEqual([]);
  });
}

// Для «/» ширину не проверяем (D-04): прежний интерфейс заморожен по D-01
for (const { path } of PAGES.filter((entry) => entry.narrow)) {
  test(`has no horizontal scroll at 375px on ${path}`, async ({ page }) => {
    await watchProblems(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(path);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Библиотека', exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/^API: /)).toBeVisible();

    const widths = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client);
  });
}
