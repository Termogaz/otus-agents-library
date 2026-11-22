import pg from 'pg';

// Таймауты пула роли приложения. Без них запрос на заблокированной строке или при занятом
// пуле ждал бы бесконечно, а 503 DB_BUSY «после таймаута» из спеки не наступал бы никогда.
export type DbTimeouts = {
  // statement_timeout: предел одного запроса (SQLSTATE 57014)
  statementTimeoutMs: number;
  // lock_timeout: предел ожидания блокировки строки, например select ... for update (55P03)
  lockTimeoutMs: number;
  // connectionTimeoutMillis: предел ожидания соединения из пула или нового подключения
  connectionTimeoutMs: number;
};

export const DEFAULT_DB_TIMEOUTS: DbTimeouts = {
  statementTimeoutMs: 10_000,
  lockTimeoutMs: 5_000,
  connectionTimeoutMs: 5_000,
};

// Пул с таймаутами: statement_timeout и lock_timeout уходят параметрами подключения и действуют
// на каждый запрос соединения, включая вход через auth_* и транзакции запросов
export function createPool(
  connectionString: string | undefined,
  options: DbTimeouts & { max?: number },
): pg.Pool {
  const pool = new pg.Pool({
    connectionString,
    statement_timeout: options.statementTimeoutMs,
    lock_timeout: options.lockTimeoutMs,
    connectionTimeoutMillis: options.connectionTimeoutMs,
    ...(options.max === undefined ? {} : { max: options.max }),
  });
  // Без обработчика ошибка на простаивающем соединении роняет процесс
  pool.on('error', (error) => {
    console.error('Ошибка соединения пула Postgres:', error.message);
  });
  return pool;
}
