import { expect, test } from '@playwright/test';

test('shows app title and healthy API status', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Библиотека' })).toBeVisible();
  await expect(page.getByText('API: ok')).toBeVisible();
});
