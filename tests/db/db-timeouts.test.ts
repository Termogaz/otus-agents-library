import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.js';
import { httpErrorFromDatabase } from '../../src/server/postgres/pg-errors.js';
import { createPool } from '../../src/server/postgres/pool.js';
import { PostgresStorage } from '../../src/server/postgres/postgres-storage.js';
import { apiPool, asLibrarian, ownerPool, requireTestUrls, resetData } from './support/db.js';

const owner = ownerPool();
const api = apiPool();

beforeEach(async () => {
  await resetData(owner);
});

afterAll(async () => {
  await Promise.all([owner.end(), api.end()]);
});

// Короткие таймауты, чтобы тест не ждал секундами
const SHORT = { statementTimeoutMs: 300, lockTimeoutMs: 200, connectionTimeoutMs: 300 };

// Отдельное соединение держит блокировку строки книги, пока тест не отпустит её сам
async function holdBookLock(id: string): Promise<pg.Client> {
  const holder = new pg.Client({ connectionString: requireTestUrls().apiUrl });
  await holder.connect();
  await holder.query('begin');
  await holder.query("select set_config('app.role', 'librarian', true)");
  await holder.query('select id from books where id = $1 for update', [id]);
  return holder;
}

describe('database timeouts', () => {
  it('answers 503 DB_BUSY when a checkout waits for a locked book longer than lock_timeout', async () => {
    await asLibrarian(api, async (c) => {
      await c.query(
        "insert into books (id, title, author, isbn, copies) values ('b1', 'Книга', 'Автор', 'isbn-1', 1)",
      );
      await c.query("insert into readers (id, name, contact) values ('r1', 'Читатель', 'r1@x')");
    });
    const pool = createPool(requireTestUrls().apiUrl, SHORT);
    const holder = await holdBookLock('b1');
    try {
      const app = createApp({ storage: new PostgresStorage(pool) });

      const res = await request(app).post('/api/loans').send({ bookId: 'b1', readerId: 'r1' });

      expect(res.status).toBe(503);
      expect(res.body.code).toBe('DB_BUSY');
    } finally {
      await holder.query('rollback').catch(() => {});
      await holder.end();
      await pool.end();
    }
  });

  it('stops a statement that runs longer than statement_timeout', async () => {
    const pool = createPool(requireTestUrls().apiUrl, SHORT);
    try {
      const error: unknown = await pool.query('select pg_sleep(2)').then(
        () => undefined,
        (e: unknown) => e,
      );

      expect(httpErrorFromDatabase(error)).toEqual({ status: 503, code: 'DB_BUSY' });
    } finally {
      await pool.end();
    }
  });

  it('gives up waiting for a free pool connection after connectionTimeoutMillis', async () => {
    const pool = createPool(requireTestUrls().apiUrl, { ...SHORT, max: 1 });
    const busy = await pool.connect();
    try {
      const error: unknown = await pool.connect().then(
        (client) => {
          client.release();
          return undefined;
        },
        (e: unknown) => e,
      );

      expect(httpErrorFromDatabase(error)).toEqual({ status: 503, code: 'DB_UNAVAILABLE' });
    } finally {
      busy.release();
      await pool.end();
    }
  });
});
