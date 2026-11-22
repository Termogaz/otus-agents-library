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
  const cors = { allowedOrigins: config.corsAllowedOrigins };

  if (config.storage === 'postgres') {
    const pool = new pg.Pool({ connectionString: config.databaseUrl });
    // Без обработчика ошибка на простаивающем соединении роняет процесс
    pool.on('error', (error) => {
      console.error('Ошибка соединения пула Postgres:', error.message);
    });
    // В режиме Postgres вход обязателен; в режиме JSON входа нет
    const app = createApp({
      storage: new PostgresStorage(pool),
      auth: { store: new PgAuthStore(pool), limiter: new LoginLimiter() },
      cors,
    });
    trustProxies(app, config);
    return { app, close: () => pool.end() };
  }

  const app = createApp({ repo: new JsonFileRepository(config.dataFile), cors });
  trustProxies(app, config);
  return { app, close: () => Promise.resolve() };
}

// За Caddy и nginx Express должен видеть HTTPS (req.secure, Secure-cookie): число доверенных
// прокси задаёт TRUST_PROXY. По умолчанию 0: заголовки X-Forwarded-* от клиента не принимаются.
function trustProxies(app: express.Express, config: AppConfig): void {
  app.set('trust proxy', config.trustProxy);
}
