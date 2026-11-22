import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // mpa: без этого dev-сервер отдаёт корневую страницу на любой путь, в том числе на /v2/ и /prototype/
  appType: 'mpa',
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src/client-v2'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // Host остаётся адресом страницы (localhost:5173): без этого сокращённая запись Vite
      // подменяет его на адрес API, и проверка Origin на записи принимает свой хост за чужой
      '/api': { target: 'http://localhost:3000', changeOrigin: false },
    },
  },
  build: {
    outDir: 'dist/client',
    // Три страницы из одного проекта: старый фронт, вариант 2 и прототип
    rolldownOptions: {
      input: {
        main: 'index.html',
        v2: 'v2/index.html',
        prototype: 'prototype/index.html',
      },
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
