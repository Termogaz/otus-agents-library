import type express from 'express';
import pg from 'pg';
import { createApp } from './app.js';
import { PgAuthStore } from './auth/auth.js';
import { LoginLimiter } from './auth/login-limiter.js';
import type { AppConfig } from './config.js';
import { JsonFileRepository } from './json-file-repository.js';
import { PostgresStorage } from './postgres/postgres-storage.js';

// Собирает приложение по конфигу: хранилище выбирается по STORAGE.
// close освобождает ресурсы (пул соединений Postgres).
export function buildApp(config: AppConfig): {
  app: express.Express;
  close: () => Promise<void>;
} {
  if (config.storage === 'postgres') {
    const pool = new pg.Pool({ connectionString: config.databaseUrl });
    // Без обработчика ошибка на простаивающем соединении роняет процесс
    pool.on('error', (error) => {
      console.error('Ошибка соединения пула Postgres:', error.message);
    });
    return {
      // В режиме Postgres вход обязателен; в режиме JSON входа нет
      app: createApp({
        storage: new PostgresStorage(pool),
        auth: { store: new PgAuthStore(pool), limiter: new LoginLimiter() },
      }),
      close: () => pool.end(),
    };
  }

  return {
    app: createApp({ repo: new JsonFileRepository(config.dataFile) }),
    close: () => Promise.resolve(),
  };
}
