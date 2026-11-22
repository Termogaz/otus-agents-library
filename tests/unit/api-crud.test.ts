import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.js';
import { JsonFileRepository } from '../../src/server/json-file-repository.js';
import { loadApiSpec } from '../support/api-spec.js';

// Тот же набор CRUD-кейсов, что в tests/db/api-crud.test.ts, но на JSON-файле (STORAGE=json)

const bookInput = { title: 'Мастер и Маргарита', author: 'М. Булгаков', isbn: '978-5-17-090631-9' };

let dir: string;
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'library-crud-'));
  let seq = 0;
  app = createApp({
    repo: new JsonFileRepository(join(dir, 'library.json')),
    now: () => new Date('2026-10-17T10:00:00Z'),
    newId: () => `id${++seq}`,
  });
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function createBook(copies = 1): Promise<string> {
  const res = await request(app)
    .post('/api/books')
    .send({ ...bookInput, copies });
  expect(res.status).toBe(201);
  return res.body.id as string;
}

async function createReader(): Promise<string> {
  const res = await request(app)
    .post('/api/readers')
    .send({ name: 'Анна', contact: 'a@example.com' });
  expect(res.status).toBe(201);
  return res.body.id as string;
}

async function checkout(bookId: string, readerId: string): Promise<string> {
  const res = await request(app).post('/api/loans').send({ bookId, readerId });
  expect(res.status).toBe(201);
  return res.body.id as string;
}

describe('books by id (json)', () => {
  it('gets a book with free copies', async () => {
    const bookId = await createBook(3);
    await checkout(bookId, await createReader());

    const res = await request(app).get(`/api/books/${bookId}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: bookId, ...bookInput, copies: 3, available: 2 });
  });

  it('answers 404 BOOK_NOT_FOUND for unknown id', async () => {
    const res = await request(app).get('/api/books/nope');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('BOOK_NOT_FOUND');
  });

  it('updates title and copies', async () => {
    const bookId = await createBook(1);

    const res = await request(app)
      .patch(`/api/books/${bookId}`)
      .send({ title: 'Новое', copies: 4 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: bookId, title: 'Новое', copies: 4, available: 4 });
    expect((await request(app).get(`/api/books/${bookId}`)).body.title).toBe('Новое');
  });

  it('rejects copies below active loans and an empty patch', async () => {
    const bookId = await createBook(3);
    await checkout(bookId, await createReader());
    await checkout(bookId, await createReader());

    const below = await request(app).patch(`/api/books/${bookId}`).send({ copies: 1 });
    const empty = await request(app).patch(`/api/books/${bookId}`).send({});

    expect(below.status).toBe(409);
    expect(below.body.code).toBe('COPIES_BELOW_ACTIVE_LOANS');
    expect(empty.status).toBe(400);
    expect(empty.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('readers by id (json)', () => {
  it('gets a reader by id', async () => {
    const readerId = await createReader();

    const res = await request(app).get(`/api/readers/${readerId}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: readerId, name: 'Анна', contact: 'a@example.com' });
  });

  it('updates reader contact', async () => {
    const readerId = await createReader();

    const res = await request(app)
      .patch(`/api/readers/${readerId}`)
      .send({ contact: 'n@example.com' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: readerId, name: 'Анна', contact: 'n@example.com' });
  });

  it('answers 404 READER_NOT_FOUND for unknown reader', async () => {
    const got = await request(app).get('/api/readers/nope');
    const patched = await request(app).patch('/api/readers/nope').send({ name: 'Имя' });

    expect(got.status).toBe(404);
    expect(got.body.code).toBe('READER_NOT_FOUND');
    expect(patched.status).toBe(404);
    expect(patched.body.code).toBe('READER_NOT_FOUND');
  });
});

describe('deletion (json)', () => {
  it('deletes a book and a reader without loans', async () => {
    const bookId = await createBook();
    const readerId = await createReader();

    expect((await request(app).delete(`/api/books/${bookId}`)).status).toBe(204);
    expect((await request(app).delete(`/api/readers/${readerId}`)).status).toBe(204);
    expect((await request(app).get(`/api/books/${bookId}`)).status).toBe(404);
    expect((await request(app).get(`/api/readers/${readerId}`)).status).toBe(404);
  });

  it('refuses to delete a book and a reader with an active loan', async () => {
    const bookId = await createBook();
    const readerId = await createReader();
    await checkout(bookId, readerId);

    const book = await request(app).delete(`/api/books/${bookId}`);
    const reader = await request(app).delete(`/api/readers/${readerId}`);

    expect(book.status).toBe(409);
    expect(book.body.code).toBe('BOOK_HAS_ACTIVE_LOANS');
    expect(reader.status).toBe(409);
    expect(reader.body.code).toBe('READER_HAS_ACTIVE_LOANS');
  });

  it('refuses to delete a book and a reader with loan history', async () => {
    const bookId = await createBook();
    const readerId = await createReader();
    const loanId = await checkout(bookId, readerId);
    await request(app).post(`/api/loans/${loanId}/return`);

    const book = await request(app).delete(`/api/books/${bookId}`);
    const reader = await request(app).delete(`/api/readers/${readerId}`);

    expect(book.status).toBe(409);
    expect(book.body.code).toBe('BOOK_HAS_LOAN_HISTORY');
    expect(reader.status).toBe(409);
    expect(reader.body.code).toBe('READER_HAS_LOAN_HISTORY');
    // История выдач на месте
    const loans = await request(app).get('/api/loans');
    expect(loans.body).toHaveLength(1);
  });

  it('answers 404 when deleting an unknown book or reader', async () => {
    const book = await request(app).delete('/api/books/nope');
    const reader = await request(app).delete('/api/readers/nope');

    expect(book.status).toBe(404);
    expect(book.body.code).toBe('BOOK_NOT_FOUND');
    expect(reader.status).toBe(404);
    expect(reader.body.code).toBe('READER_NOT_FOUND');
  });
});

describe('input limits (json)', () => {
  it('rejects a NUL character, an over-long text and too many copies', async () => {
    const nul = await request(app)
      .post('/api/books')
      .send({ ...bookInput, title: 'a\u0000b', copies: 1 });
    const long = await request(app)
      .post('/api/readers')
      .send({ name: 'А'.repeat(501), contact: 'a@example.com' });
    const copies = await request(app)
      .post('/api/books')
      .send({ ...bookInput, copies: 3_000_000_000 });

    expect([nul.status, nul.body.code]).toEqual([400, 'VALIDATION_ERROR']);
    expect([long.status, long.body.code]).toEqual([400, 'VALIDATION_ERROR']);
    expect([copies.status, copies.body.code]).toEqual([400, 'VALIDATION_ERROR']);
  });

  it('accepts the largest allowed copies and text length', async () => {
    const res = await request(app)
      .post('/api/books')
      .send({ ...bookInput, title: 'Т'.repeat(500), copies: 10_000 });

    expect(res.status).toBe(201);
  });
});

describe('spec coverage (json)', () => {
  it('implements every books and readers route of the spec', async () => {
    const routes = loadApiSpec().filter(
      (r) => r.path.startsWith('/api/books') || r.path.startsWith('/api/readers'),
    );
    expect(routes.length).toBeGreaterThanOrEqual(10);

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
