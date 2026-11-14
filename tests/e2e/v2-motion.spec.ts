import { expect, test, type Page } from '@playwright/test';
import type { BookView, LoanView, ReaderView } from '../../src/client/api';
import { stubLists } from './fake-api';

// Анимации входа на /v2/ (D-07): сообщения не накладываются друг на друга (FR-2, D-12),
// при prefers-reduced-motion итог появляется сразу, на старой странице анимаций нет.

test.use({ viewport: { width: 1280, height: 900 } });

const books: BookView[] = [
  {
    id: 'b1',
    title: 'Мастер и Маргарита',
    author: 'М. Булгаков',
    isbn: '978-5-17-090631-9',
    copies: 1,
    available: 1,
  },
];
const readers: ReaderView[] = [{ id: 'r1', name: 'Анна Петрова', contact: 'anna@example.com' }];
const loans: LoanView[] = [];

async function openCheckoutForm(page: Page) {
  await stubLists(page, { books, readers, loans });
  await page.goto('/v2/');
  const section = page.getByRole('region', { name: 'Выдачи', exact: true });
  await section.getByLabel('Книга', { exact: true }).selectOption({ label: 'Мастер и Маргарита' });
  await section.getByLabel('Читатель', { exact: true }).selectOption({ label: 'Анна Петрова' });
  return section.getByRole('button', { name: 'Выдать' });
}

// Ответ на POST /api/loans по номеру запроса: отказ с кодом или успех
async function answerCheckouts(page: Page, answers: (string | 'ok')[]) {
  let calls = 0;
  await page.route('**/api/loans', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    const answer = answers[Math.min(calls, answers.length - 1)];
    calls += 1;
    if (answer === 'ok') {
      await route.fulfill({
        status: 201,
        json: { id: 'l1', bookId: 'b1', readerId: 'r1', dueAt: '2026-12-10T10:00:00.000Z' },
      });
    } else {
      await route.fulfill({ status: 409, json: { code: answer } });
    }
  });
}

test('keeps a single alert during rapid refusals', async ({ page }) => {
  await answerCheckouts(page, ['NO_FREE_COPIES', 'LOAN_LIMIT_REACHED']);
  const checkout = await openCheckoutForm(page);

  await checkout.click();
  await expect(page.getByRole('alert')).toHaveText('Нет свободных экземпляров');
  await checkout.click();
  // Второй отказ заменяет первый: рядом с ним старого сообщения нет ни на мгновение
  await expect(page.getByRole('alert')).toHaveText('Читатель уже взял максимум книг');
  await expect(page.getByRole('alert')).toHaveCount(1);
});

test('replaces alert with status without overlap', async ({ page }) => {
  await answerCheckouts(page, ['NO_FREE_COPIES', 'ok']);
  const checkout = await openCheckoutForm(page);

  await checkout.click();
  await expect(page.getByRole('alert')).toHaveText('Нет свободных экземпляров');
  await checkout.click();
  await expect(page.getByRole('status')).toContainText('Выдано');
  // К моменту появления подтверждения отказа на странице уже нет
  expect(await page.getByRole('alert').count()).toBe(0);
});

test('shows outcome at once when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await answerCheckouts(page, ['ok']);
  const checkout = await openCheckoutForm(page);

  await checkout.click();
  const status = page.getByRole('status');
  await expect(status).toBeVisible();
  // Первое же чтение стиля: без анимации итог уже полностью проявлен и не сдвинут
  const style = await status.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { opacity: computed.opacity, transform: computed.transform };
  });
  expect(style).toEqual({ opacity: '1', transform: 'none' });
});

test('animates only on v2 pages', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Библиотека' })).toBeVisible();
  await expect(page.getByText('API: ok')).toBeVisible();
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});
