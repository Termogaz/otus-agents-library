import type express from 'express';
import { createApp } from './app.js';
import { PgAuthStore } from './auth/auth.js';
import { LoginLimiter } from './auth/login-limiter.js';
import type { AppConfig } from './config.js';
import { JsonFileRepository } from './json-file-repository.js';
import { PgAiQuota } from './postgres/ai-quota.js';
import { createPool, DEFAULT_DB_TIMEOUTS } from './postgres/pool.js';
import { PostgresStorage } from './postgres/postgres-storage.js';

// Собирает приложение по конфигу: хранилище выбирается по STORAGE.
// close освобождает ресурсы (пул соединений Postgres).
export function buildApp(config: AppConfig): {
  app: express.Express;
  close: () => Promise<void>;
} {
  const cors = { allowedOrigins: config.corsAllowedOrigins };

  if (config.storage === 'postgres') {
    // Таймауты запроса, блокировки и соединения: без них запрос мог бы ждать бесконечно
    const pool = createPool(config.databaseUrl, config.db ?? DEFAULT_DB_TIMEOUTS);
    // В режиме Postgres вход обязателен; в режиме JSON входа нет
    const app = createApp({
      storage: new PostgresStorage(pool),
      auth: { store: new PgAuthStore(pool), limiter: new LoginLimiter() },
      cors,
      // Без ключа ai не передаётся: маршрут отвечает 503 AI_DISABLED
      ...(config.ai.apiKey
        ? {
            ai: {
              apiKey: config.ai.apiKey,
              model: config.ai.model,
              dailyLimit: config.ai.dailyLimit,
              quota: new PgAiQuota(pool),
            },
          }
        : {}),
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
