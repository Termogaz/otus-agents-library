import { expect, test, type Page } from '@playwright/test';
import { accounts } from '../fixtures/accounts';

// Страница входа /login/ (D-12). Учётки берутся из tests/fixtures/accounts.ts.
const ANONYMOUS = { cookies: [], origins: [] };

async function fillLogin(page: Page, password: string): Promise<void> {
  await page.getByLabel('Логин').fill(accounts.librarian.login);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
}

test.describe('anonymous visitor', () => {
  test.use({ storageState: ANONYMOUS });

  test('logs in and opens the next page', async ({ page }) => {
    await page.goto('/login/?next=/v2/');
    await fillLogin(page, accounts.librarian.password);

    await expect(page).toHaveURL(/\/v2\/$/);
    await expect(page.getByRole('heading', { name: 'Библиотека' })).toBeVisible();
  });

  test('shows an error for a wrong password', async ({ page }) => {
    await page.goto('/login/');
    await fillLogin(page, 'wrong-password-value');

    await expect(page.getByRole('alert')).toHaveText('Неверный логин или пароль');
    const password = page.getByLabel('Пароль');
    await expect(password).toHaveValue('');
    await expect(password).toBeFocused();
    await expect(page).toHaveURL(/\/login\//);
  });

  test('ignores a next pointing to another site', async ({ page }) => {
    await page.goto('/login/?next=//evil.example');
    await fillLogin(page, accounts.librarian.password);

    await expect(page).toHaveURL(/^http:\/\/localhost:5173\/v2\/$/);
  });

  test('shows server unavailable when the API is down', async ({ page }) => {
    await page.route('**/api/auth/login', (route) => route.abort());
    await page.goto('/login/');
    await fillLogin(page, accounts.librarian.password);

    await expect(page.getByRole('alert')).toHaveText('Сервер недоступен');
  });
});

test('goes straight to the next page when already logged in', async ({ page }) => {
  await page.goto('/login/');

  await expect(page).toHaveURL(/\/v2\/$/);
});
