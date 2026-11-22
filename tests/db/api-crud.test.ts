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

describe('deletion', () => {
  it('deletes a book without loans', async () => {
    await insertBook('b1');
    const app = makeApp();

    const res = await request(app).delete('/api/books/b1');

    expect(res.status).toBe(204);
    expect((await request(app).get('/api/books/b1')).status).toBe(404);
    expect(await countRows('books', 'b1')).toBe(0);
  });

  it('refuses to delete a book with an active loan', async () => {
    await insertBook('b1');
    await insertReader('r1');
    await insertLoan('l1', 'b1', 'r1');

    const res = await request(makeApp()).delete('/api/books/b1');

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('BOOK_HAS_ACTIVE_LOANS');
    expect(await countRows('books', 'b1')).toBe(1);
  });

  it('refuses to delete a book with loan history', async () => {
    await insertBook('b1');
    await insertReader('r1');
    await insertLoan('l1', 'b1', 'r1', true);

    const res = await request(makeApp()).delete('/api/books/b1');

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('BOOK_HAS_LOAN_HISTORY');
    // История выдач на месте
    expect(await countRows('books', 'b1')).toBe(1);
    expect(await countRows('loans', 'l1')).toBe(1);
  });

  it('deletes a reader without loans', async () => {
    await insertReader('r1');
    const app = makeApp();

    const res = await request(app).delete('/api/readers/r1');

    expect(res.status).toBe(204);
    expect((await request(app).get('/api/readers/r1')).status).toBe(404);
    expect(await countRows('readers', 'r1')).toBe(0);
  });

  it('refuses to delete a reader with an active loan', async () => {
    await insertBook('b1');
    await insertReader('r1');
    await insertLoan('l1', 'b1', 'r1');

    const res = await request(makeApp()).delete('/api/readers/r1');

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('READER_HAS_ACTIVE_LOANS');
    expect(await countRows('readers', 'r1')).toBe(1);
  });

  it('refuses to delete a reader with loan history', async () => {
    await insertBook('b1');
    await insertReader('r1');
    await insertLoan('l1', 'b1', 'r1', true);

    const res = await request(makeApp()).delete('/api/readers/r1');

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('READER_HAS_LOAN_HISTORY');
    expect(await countRows('readers', 'r1')).toBe(1);
    expect(await countRows('loans', 'l1')).toBe(1);
  });

  it('answers 404 when deleting an unknown book or reader', async () => {
    const app = makeApp();

    const book = await request(app).delete('/api/books/nope');
    const reader = await request(app).delete('/api/readers/nope');

    expect(book.status).toBe(404);
    expect(book.body.code).toBe('BOOK_NOT_FOUND');
    expect(reader.status).toBe(404);
    expect(reader.body.code).toBe('READER_NOT_FOUND');
  });
});

describe('readers by id', () => {
  it('creates a reader over HTTP and stores it in Postgres', async () => {
    const app = makeApp();

    const created = await request(app)
      .post('/api/readers')
      .send({ name: 'Анна', contact: 'anna@example.com' });

    expect(created.status).toBe(201);
    const id = created.body.id as string;
    const got = await request(app).get(`/api/readers/${id}`);
    expect(got.status).toBe(200);
    expect(got.body).toEqual({ id, name: 'Анна', contact: 'anna@example.com' });
    const { rows } = await owner.query('select name, contact from readers where id = $1', [id]);
    expect(rows).toEqual([{ name: 'Анна', contact: 'anna@example.com' }]);
  });

  it('gets a reader by id', async () => {
    await insertReader('r1');

    const res = await request(makeApp()).get('/api/readers/r1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 'r1', name: 'Читатель r1', contact: 'r1@example.com' });
  });

  it('updates reader contact', async () => {
    await insertReader('r1');

    const res = await request(makeApp())
      .patch('/api/readers/r1')
      .send({ contact: 'new@example.com' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 'r1', name: 'Читатель r1', contact: 'new@example.com' });
    const { rows } = await owner.query('select name, contact from readers where id = $1', ['r1']);
    expect(rows).toEqual([{ name: 'Читатель r1', contact: 'new@example.com' }]);
  });

  it('rejects an empty reader patch', async () => {
    await insertReader('r1');

    const res = await request(makeApp()).patch('/api/readers/r1').send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('answers 404 READER_NOT_FOUND for unknown reader', async () => {
    const app = makeApp();

    const got = await request(app).get('/api/readers/nope');
    const patched = await request(app).patch('/api/readers/nope').send({ name: 'Имя' });

    expect(got.status).toBe(404);
    expect(got.body.code).toBe('READER_NOT_FOUND');
    expect(patched.status).toBe(404);
    expect(patched.body.code).toBe('READER_NOT_FOUND');
  });
});

describe('spec coverage', () => {
  it('implements every books and readers route of the spec', async () => {
    const routes = loadApiSpec().filter(
      (r) => r.path.startsWith('/api/books') || r.path.startsWith('/api/readers'),
    );
    expect(routes.length).toBeGreaterThanOrEqual(10);
    const app = makeApp();

    for (const route of routes) {
      const path = route.path.replace(':id', 'nope');
      const body = route.method === 'PATCH' ? { title: 'x', name: 'x' } : {};
      const res = await request(app)[route.method.toLowerCase() as 'get'](path).send(body);

      // Встроенный 404 Express приходит без тела: у каждого маршрута спеки свой обработчик
      const label = `${route.method} ${route.path}`;
      if (route.path.includes(':id')) {
        expect(res.status, label).toBe(404);
        expect(res.body.code, label).toMatch(/^(BOOK|READER)_NOT_FOUND$/);
      } else if (route.method === 'POST') {
        expect(res.status, label).toBe(400);
        expect(res.body.code, label).toBe('VALIDATION_ERROR');
      } else {
        expect(res.status, label).toBe(route.success);
      }
    }
  });
});
