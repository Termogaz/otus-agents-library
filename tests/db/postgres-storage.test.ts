import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.js';
import { PostgresStorage } from '../../src/server/postgres/postgres-storage.js';
import { apiPool, ownerPool, requireTestUrls, resetData } from './support/db.js';

const owner = ownerPool();
const api = apiPool();
// Пул с одним соединением: следующий запрос гарантированно идёт по тому же соединению
const single = new pg.Pool({ connectionString: requireTestUrls().apiUrl, max: 1 });
single.on('error', () => {});

beforeEach(async () => {
  await resetData(owner);
});

afterAll(async () => {
  await Promise.all([owner.end(), api.end(), single.end()]);
});

describe('PostgresStorage', () => {
  it('creates a book over HTTP and stores it in Postgres', async () => {
    let seq = 0;
    const app = createApp({ storage: new PostgresStorage(api), newId: () => `book${++seq}` });

    const created = await request(app).post('/api/books').send({
      title: 'Мастер и Маргарита',
      author: 'М. Булгаков',
      isbn: '978-5-17-090631-9',
      copies: 3,
    });
    expect(created.status).toBe(201);

    const { rows } = await owner.query('select title, copies from books');
    expect(rows).toEqual([{ title: 'Мастер и Маргарита', copies: 3 }]);

    const listed = await request(app).get('/api/books');
    expect(listed.status).toBe(200);
    expect(listed.body).toEqual([
      expect.objectContaining({
        id: 'book1',
        title: 'Мастер и Маргарита',
        copies: 3,
        available: 3,
      }),
    ]);
  });

  it('does not leak request context to the next query on the pooled connection', async () => {
    const storage = new PostgresStorage(single);
    await storage.run({ userId: 'u1', role: 'reader', readerId: 'r1' }, (repo) => repo.listBooks());

    const { rows } = await single.query<{ role: string }>(
      "select coalesce(current_setting('app.role', true), '') as role",
    );
    expect(rows[0]?.role).toBe('');
  });

  it('rolls back when the unit of work throws', async () => {
    const storage = new PostgresStorage(api);
    const ctx = { userId: null, role: 'librarian', readerId: null } as const;

    await expect(
      storage.run(ctx, async (repo) => {
        await repo.saveBook({ id: 'b1', title: 'T', author: 'A', isbn: 'I', copies: 1 });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const { rows } = await owner.query('select id from books');
    expect(rows).toEqual([]);
  });
});
