import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

// Конфиг для прогона e2e на контейнере (07-08) и на публичной ссылке (07-09):
// свой сервер не поднимается, адрес берётся из E2E_BASE_URL.
export default defineConfig({
  ...baseConfig,
  webServer: undefined,
  use: {
    ...baseConfig.use,
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:8080',
  },
});
