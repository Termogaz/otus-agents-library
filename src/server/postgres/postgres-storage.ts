import type pg from 'pg';
import type { LibraryRepository } from '../repository.js';
import type { RequestContext, Storage } from '../storage.js';
import { PostgresRepository } from './postgres-repository.js';

// Одна транзакция с контекстом пользователя. Контекст кладётся в GUC с третьим аргументом
// true: значение живёт до конца транзакции и не переходит к другому запросу на том же
// соединении пула (D-06).
export async function withRequestContext<T>(
  pool: pg.Pool,
  ctx: RequestContext,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(
      "select set_config('app.user_id', $1, true), set_config('app.role', $2, true), set_config('app.reader_id', $3, true)",
      [ctx.userId ?? '', ctx.role, ctx.readerId ?? ''],
    );
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    // Своя ошибка отката не должна заслонять исходную
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

// Каждый запрос — одна транзакция
export class PostgresStorage implements Storage {
  constructor(private readonly pool: pg.Pool) {}

  run<T>(ctx: RequestContext, fn: (repo: LibraryRepository) => Promise<T>): Promise<T> {
    return withRequestContext(this.pool, ctx, (client) => fn(new PostgresRepository(client)));
  }
}
