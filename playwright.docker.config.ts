import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

// Конфиг для прогона e2e на контейнере (07-08) и на публичной ссылке (07-09):
// свой сервер не поднимается, адрес берётся из E2E_BASE_URL.
// globalSetup отключён: чужой стенд не очищается и учётки на нём не создаются (T-08-32).
// Setup-проект и storageState наследуются от базового конфига: входят учётки из
// tests/fixtures/accounts.ts, для стенда их задают переменные E2E_LIBRARIAN_LOGIN,
// E2E_LIBRARIAN_PASSWORD, E2E_READER_LOGIN, E2E_READER_PASSWORD (автор, 08-13).
export default defineConfig({
  ...baseConfig,
  globalSetup: undefined,
  webServer: undefined,
  use: {
    ...baseConfig.use,
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:8080',
  },
});
