import { defineConfig } from 'vitest/config';
import { loadLocalEnv } from './src/server/env-file.js';

// Тестовые URL лежат в файле окружения автора; уже заданные в оболочке или CI не перезаписываются
loadLocalEnv();

// Тесты БД идут отдельным прогоном: им нужен живой Postgres (npm run db:up), а в npm test они не входят.
// Файлы идут по одному: все работают с одной базой library_test.
export default defineConfig({
  test: {
    include: ['tests/db/**/*.test.ts'],
    globalSetup: ['tests/db/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
