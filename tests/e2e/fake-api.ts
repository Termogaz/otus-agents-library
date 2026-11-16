// Вспомогательное для e2e: управляемая задержка ответа сервера и подмена списков без пауз по времени.
import type { Page } from '@playwright/test';
import type { BookView, LoanView, ReaderView } from '../../src/client/api';

// Ворота: запрос ждёт `opened`, пока тест не вызовет `open()`
export function createGate(): { opened: Promise<void>; open: () => void } {
  let open: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { opened, open };
}

// Подмена списков: GET книг, читателей и выдач отдаёт заданные данные, остальные методы идут дальше
export async function stubLists(
  page: Page,
  data: { books: BookView[]; readers: ReaderView[]; loans: LoanView[] },
): Promise<void> {
  const routes: [string, unknown][] = [
    ['**/api/books', data.books],
    ['**/api/readers', data.readers],
    ['**/api/loans', data.loans],
  ];
  for (const [pattern, body] of routes) {
    await page.route(pattern, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: body });
      } else {
        await route.fallback();
      }
    });
  }
}
