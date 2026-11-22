import { test as setup } from '@playwright/test';
import { accounts } from '../fixtures/accounts';

// Вход один раз на прогон: сессия сохраняется в storageState и подхватывается проектом chromium.
// Каталог playwright/.auth в .gitignore: в файлах токены сессий.
async function loginAndSave(
  request: import('@playwright/test').APIRequestContext,
  account: { login: string; password: string },
  file: string,
): Promise<void> {
  const res = await request.post('/api/auth/login', {
    data: { login: account.login, password: account.password },
  });
  if (!res.ok()) {
    throw new Error(`вход ${account.login} не удался: статус ${res.status()}`);
  }
  await request.storageState({ path: file });
}

setup('login librarian', async ({ request }) => {
  await loginAndSave(request, accounts.librarian, 'playwright/.auth/librarian.json');
});

setup('login reader', async ({ request }) => {
  await loginAndSave(request, accounts.reader, 'playwright/.auth/reader.json');
});
