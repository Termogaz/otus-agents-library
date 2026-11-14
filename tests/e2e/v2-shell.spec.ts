import { expect, test } from '@playwright/test';

test('opens v2 page with its own title and design tokens', async ({ page }) => {
  await page.goto('/v2/');

  await expect(page).toHaveTitle('Библиотека, вариант 2');
  const heading = page.getByRole('heading', { level: 1, name: 'Библиотека' });
  await expect(heading).toBeVisible();
  // Цвета берутся из токенов DESIGN.md: text и bg
  await expect(heading).toHaveCSS('color', 'rgb(28, 43, 29)');
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(background).toBe('rgb(242, 249, 251)');
});

test('opens prototype page with its own title', async ({ page }) => {
  await page.goto('/prototype/');

  await expect(page).toHaveTitle('Библиотека, прототип');
  await expect(page.getByRole('heading', { level: 1, name: 'Библиотека' })).toBeVisible();
  await expect(page.getByText('Прототип на демо-данных')).toBeVisible();
});
