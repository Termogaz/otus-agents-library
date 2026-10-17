import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('issues a book to a reader and accepts it back', async ({ page }) => {
  // Уникальные названия: e2e пишет в общий файл данных dev-сервера
  const tag = randomUUID().slice(0, 8);
  const title = `Мастер и Маргарита ${tag}`;
  const readerName = `Анна ${tag}`;

  await page.goto('/');

  const bookForm = page.getByRole('form', { name: 'Добавить книгу' });
  await bookForm.getByLabel('Название').fill(title);
  await bookForm.getByLabel('Автор').fill('М. Булгаков');
  await bookForm.getByLabel('ISBN').fill('978-5-17-090631-9');
  await bookForm.getByLabel('Экземпляров').fill('1');
  await bookForm.getByRole('button', { name: 'Добавить' }).click();

  const bookRow = page.getByRole('table', { name: 'Книги' }).getByRole('row', { name: title });
  await expect(bookRow).toContainText('1 из 1');

  const readerForm = page.getByRole('form', { name: 'Добавить читателя' });
  await readerForm.getByLabel('Имя').fill(readerName);
  await readerForm.getByLabel('Контакт').fill('anna@example.com');
  await readerForm.getByRole('button', { name: 'Добавить' }).click();

  const loanForm = page.getByRole('form', { name: 'Выдать книгу' });
  await loanForm.getByLabel('Книга').selectOption({ label: title });
  await loanForm.getByLabel('Читатель').selectOption({ label: readerName });
  await loanForm.getByRole('button', { name: 'Выдать' }).click();

  await expect(bookRow).toContainText('0 из 1');
  const loanRow = page.getByRole('table', { name: 'Выдачи' }).getByRole('row', { name: title });
  await expect(loanRow).toContainText(readerName);
  await expect(loanRow).toContainText('На руках');

  // Второй экземпляр выдать нельзя: отказ домена показывается пользователю
  await loanForm.getByRole('button', { name: 'Выдать' }).click();
  await expect(page.getByRole('alert')).toHaveText('Нет свободных экземпляров');

  await loanRow.getByRole('button', { name: 'Вернуть' }).click();

  await expect(loanRow).toContainText('Возвращена');
  await expect(bookRow).toContainText('1 из 1');
});
