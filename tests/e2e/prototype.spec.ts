import { expect, test, type Page } from '@playwright/test';

// Прототип /prototype/: демо-данные в памяти браузера, ни одного запроса к /api (D-10).

test.use({ viewport: { width: 1280, height: 800 } });

// Считает запросы к /api и прерывает их: прототип обязан обходиться без сервера
async function countApiRequests(page: Page): Promise<() => number> {
  let count = 0;
  await page.route('**/api/**', async (route) => {
    count += 1;
    await route.abort();
  });
  return () => count;
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
