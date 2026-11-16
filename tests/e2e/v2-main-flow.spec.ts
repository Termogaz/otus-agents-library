import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

// Основной сценарий /v2/ на настоящем сервере (D-11): книга, читатель, выдача, возврат.
// Тест не зависит от данных на сервере: GET-запросы списков пропускают только записи этого теста
// (книги и читатели с меткой, выдачи по id из ответа сервера). POST идёт на настоящий сервер.

test.use({ viewport: { width: 1280, height: 800 } });

test('completes main flow on v2 with a message on each step', async ({ page }) => {
  const tag = randomUUID().slice(0, 8);
  const title = `Демо-книга ${tag}`;
  const name = `Демо-читатель ${tag}`;
  const loanIds = new Set<string>();

  await page.route('**/api/books', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const response = await route.fetch();
    const books = (await response.json()) as { title: string }[];
    return route.fulfill({ json: books.filter((book) => book.title.includes(tag)) });
  });
  await page.route('**/api/readers', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const response = await route.fetch();
    const readers = (await response.json()) as { name: string }[];
    return route.fulfill({ json: readers.filter((reader) => reader.name.includes(tag)) });
  });
  await page.route('**/api/loans', async (route) => {
    if (route.request().method() === 'POST') {
      // Идентификатор выдачи запоминается до ответа странице: к обновлению списка он уже известен
      const response = await route.fetch();
      const loan = (await response.json()) as { id?: string };
      if (loan.id !== undefined) loanIds.add(loan.id);
      return route.fulfill({ response });
    }
    const response = await route.fetch();
    const loans = (await response.json()) as { id: string }[];
    return route.fulfill({ json: loans.filter((loan) => loanIds.has(loan.id)) });
  });

  await page.goto('/v2/');

  const loans = page.getByRole('region', { name: 'Выдачи', exact: true });
  const books = page.getByRole('region', { name: 'Книги', exact: true });
  const readers = page.getByRole('region', { name: 'Читатели', exact: true });

  // Первый запуск: списки пусты, подсказки ведут к следующему шагу
  await expect(books.getByText('Каталог пуст. Добавьте первую книгу.')).toBeVisible();
  await expect(readers.getByText('Читателей пока нет. Добавьте первого читателя.')).toBeVisible();
  await expect(
    loans.getByText('Чтобы выдать книгу, сначала добавьте книгу и читателя ниже.'),
  ).toBeVisible();

  const bookForm = books.getByRole('form', { name: 'Добавить книгу' });
  await bookForm.getByLabel('Название').fill(title);
  await bookForm.getByLabel('Автор').fill('Демо-автор');
  await bookForm.getByLabel('ISBN').fill('978-0-00-000099-1');
  await bookForm.getByLabel('Экземпляров').fill('1');
  await bookForm.getByRole('button', { name: 'Добавить' }).click();
  await expect(books.getByRole('status')).toHaveText(`Книга «${title}» добавлена`);

  const readerForm = readers.getByRole('form', { name: 'Добавить читателя' });
  await readerForm.getByLabel('Имя').fill(name);
  await readerForm.getByLabel('Контакт').fill(`demo-${tag}@example.test`);
  await readerForm.getByRole('button', { name: 'Добавить' }).click();
  await expect(readers.getByRole('status')).toHaveText(`Читатель ${name} добавлен`);

  await loans.getByLabel('Книга').selectOption({ label: title });
  await loans.getByLabel('Читатель').selectOption({ label: name });
  await loans.getByRole('button', { name: 'Выдать' }).click();
  await expect(loans.getByRole('status')).toHaveText(
    new RegExp(`^Выдано: «${title}», ${name}\\. Срок: \\d\\d\\.\\d\\d\\.\\d{4}$`),
  );

  const row = loans.getByRole('table', { name: 'Выдачи' }).getByRole('row', { name: title });
  await row.getByRole('button', { name: 'Вернуть' }).click();
  await expect(loans.getByRole('status')).toHaveText(`Принято: «${title}», ${name}`);
  await expect(row).toContainText(/Возвращена \d\d\.\d\d\.\d{4}/);
  await expect(page.getByRole('alert')).toHaveCount(0);
});
