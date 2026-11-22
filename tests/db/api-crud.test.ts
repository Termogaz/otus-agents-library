import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.js';
import { PostgresStorage } from '../../src/server/postgres/postgres-storage.js';
import { loadApiSpec } from '../support/api-spec.js';
import { apiPool, asLibrarian, ownerPool, resetData } from './support/db.js';

const owner = ownerPool();
const api = apiPool();

beforeEach(async () => {
  await resetData(owner);
});

afterAll(async () => {
  await Promise.all([owner.end(), api.end()]);
});

const NOW = new Date('2026-03-01T10:00:00.000Z');

function makeApp() {
  let seq = 0;
  return createApp({
    storage: new PostgresStorage(api),
    now: () => NOW,
    newId: () => `id${++seq}`,
  });
}

// Фикстуры идут напрямую через роль приложения, минуя маршруты
async function insertBook(id: string, copies = 1): Promise<void> {
  await asLibrarian(api, (c) =>
    c.query('insert into books (id, title, author, isbn, copies) values ($1, $2, $3, $4, $5)', [
      id,
      `Книга ${id}`,
      'Автор',
      `isbn-${id}`,
      copies,
    ]),
  );
}

async function insertReader(id: string): Promise<void> {
  await asLibrarian(api, (c) =>
    c.query('insert into readers (id, name, contact) values ($1, $2, $3)', [
      id,
      `Читатель ${id}`,
      `${id}@example.com`,
    ]),
  );
}

async function insertLoan(id: string, bookId: string, readerId: string, returned = false) {
  await asLibrarian(api, (c) =>
    c.query(
      `insert into loans (id, book_id, reader_id, issued_at, due_at, returned_at)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        id,
        bookId,
        readerId,
        NOW,
        new Date(NOW.getTime() + 14 * 24 * 3600 * 1000),
        returned ? NOW : null,
      ],
    ),
  );
}

async function countRows(table: 'books' | 'readers' | 'loans', id: string): Promise<number> {
  const { rows } = await owner.query<{ n: number }>(
    `select count(*)::int as n from ${table} where id = $1`,
    [id],
  );
  return rows[0]?.n ?? 0;
}

describe('books by id', () => {
  it('gets a book with free copies', async () => {
    await insertBook('b1', 3);
    await insertReader('r1');
    await insertLoan('l1', 'b1', 'r1');

    const res = await request(makeApp()).get('/api/books/b1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 'b1',
      title: 'Книга b1',
      author: 'Автор',
      isbn: 'isbn-b1',
      copies: 3,
      available: 2,
    });
  });

  it('answers 404 BOOK_NOT_FOUND for unknown id', async () => {
    const res = await request(makeApp()).get('/api/books/nope');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('BOOK_NOT_FOUND');
  });

  it('updates title and copies', async () => {
    await insertBook('b1', 1);

    const res = await request(makeApp()).patch('/api/books/b1').send({ title: 'Новое', copies: 4 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'b1', title: 'Новое', author: 'Автор', copies: 4 });
    expect(res.body.available).toBe(4);
    const { rows } = await owner.query('select title, author, copies from books where id = $1', [
      'b1',
    ]);
    expect(rows).toEqual([{ title: 'Новое', author: 'Автор', copies: 4 }]);
  });

  it('rejects copies below active loans', async () => {
    await insertBook('b1', 3);
    await insertReader('r1');
    await insertReader('r2');
    await insertLoan('l1', 'b1', 'r1');
    await insertLoan('l2', 'b1', 'r2');

    const res = await request(makeApp()).patch('/api/books/b1').send({ copies: 1 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('COPIES_BELOW_ACTIVE_LOANS');
    const { rows } = await owner.query('select copies from books where id = $1', ['b1']);
    expect(rows).toEqual([{ copies: 3 }]);
  });

  it('rejects an empty patch', async () => {
    await insertBook('b1', 1);

    const res = await request(makeApp()).patch('/api/books/b1').send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});
