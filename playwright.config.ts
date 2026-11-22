import { defineConfig, devices } from '@playwright/test';
import { loadLocalEnv } from './src/server/env-file.js';

// Тестовые URL лежат в файле окружения автора; заданные в оболочке или CI не перезаписываются
loadLocalEnv();

const testDatabaseUrl = process.env['TEST_DATABASE_URL'];
if (!testDatabaseUrl && !process.env['E2E_BASE_URL']) {
  throw new Error(
    'e2e: задайте TEST_DATABASE_URL (тестовая база library_test) и запустите npm run db:up, см. README',
  );
}

export default defineConfig({
  testDir: 'tests/e2e',
  // Миграции, очистка и учётки library_test перед прогоном
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Без сети шрифт Google Fonts не грузится сразу: прогоны не зависят от интернета.
    // Проверка с настоящим шрифтом — с переменной E2E_REAL_FONT.
    ...(process.env['E2E_REAL_FONT']
      ? {}
      : {
          launchOptions: {
            args: [
              '--host-resolver-rules=MAP fonts.googleapis.com ~NOTFOUND, MAP fonts.gstatic.com ~NOTFOUND',
            ],
          },
        }),
  },
  projects: [
    // Вход библиотекаря и читателя, сессии сохраняются в playwright/.auth
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/librarian.json' },
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts/,
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    // Занятый порт 5173 означал бы чужой dev-сервер на другой базе
    reuseExistingServer: false,
    timeout: 60_000,
    // Сервер e2e ходит в тестовую базу, а не в dev-базу из файла окружения автора
    env: { STORAGE: 'postgres', DATABASE_URL: testDatabaseUrl ?? '' },
  },
});
