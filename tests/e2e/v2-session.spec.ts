import { expect, test, type Page } from '@playwright/test';
import { accounts } from '../fixtures/accounts';

// Сессия на /v2/ (D-12): вход обязателен, видно, кто вошёл, есть выход.
const ANONYMOUS = { cookies: [], origins: [] };

async function fillLogin(page: Page, password: string): Promise<void> {
  await page.getByLabel('Логин').fill(accounts.librarian.login);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
}

test.describe('anonymous visitor', () => {
  test.use({ storageState: ANONYMOUS });

  test('redirects an anonymous visitor to the login page', async ({ page }) => {
    await page.goto('/v2/');

    await expect(page).toHaveURL(/\/login\/\?next=%2Fv2%2F$/);
    await expect(page.getByRole('button', { name: 'Войти' })).toBeVisible();
  });

  test('returns to v2 after login', async ({ page }) => {
    await page.goto('/v2/');
    await fillLogin(page, accounts.librarian.password);

    await expect(page).toHaveURL(/\/v2\/$/);
    await expect(page.getByRole('heading', { name: 'Библиотека' })).toBeVisible();
  });
});

test('shows who is logged in and logs out', async ({ page }) => {
  await page.goto('/v2/');

  await expect(page.getByText(accounts.librarian.login)).toBeVisible();
  await expect(page.getByText('Библиотекарь', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Выйти' }).click();
  await expect(page).toHaveURL(/\/login\/$/);

  await page.goto('/v2/');
  await expect(page).toHaveURL(/\/login\/\?next=%2Fv2%2F$/);
});
