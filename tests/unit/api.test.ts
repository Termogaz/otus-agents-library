import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.js';
import { JsonFileRepository } from '../../src/server/json-file-repository.js';

const start = new Date('2026-10-17T10:00:00Z');
const day = 24 * 60 * 60 * 1000;

const bookInput = { title: 'Мастер и Маргарита', author: 'М. Булгаков', isbn: '978-5-17-090631-9' };

let dir: string;
let now: Date;
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'library-api-'));
  now = start;
  let seq = 0;
  app = createApp({
    repo: new JsonFileRepository(join(dir, 'library.json')),
    now: () => now,
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

async function createReader(name = 'Анна'): Promise<string> {
  const res = await request(app).post('/api/readers').send({ name, contact: 'anna@example.com' });
  expect(res.status).toBe(201);
  return res.body.id as string;
}

function checkout(bookId: string, readerId: string) {
  return request(app).post('/api/loans').send({ bookId, readerId });
}

describe('books API', () => {
  it('creates a book and lists it with free copies', async () => {
    const created = await request(app)
      .post('/api/books')
      .send({ ...bookInput, copies: 2 });

    expect(created.status).toBe(201);
    expect(created.body).toEqual({ id: 'id1', ...bookInput, copies: 2 });

    const list = await request(app).get('/api/books');

    expect(list.status).toBe(200);
    expect(list.body).toEqual([{ id: 'id1', ...bookInput, copies: 2, available: 2 }]);
  });

  it('decreases free copies after checkout', async () => {
    const bookId = await createBook(2);
    await checkout(bookId, await createReader());

    const list = await request(app).get('/api/books');

    expect(list.body[0].available).toBe(1);
  });

  it('rejects a book with invalid fields', async () => {
    const res = await request(app)
      .post('/api/books')
      .send({ ...bookInput, title: '', copies: 0 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects malformed JSON body', async () => {
    const res = await request(app)
      .post('/api/books')
      .set('Content-Type', 'application/json')
      .send('{ not json');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_JSON');
  });
});

describe('readers API', () => {
  it('creates a reader and lists it', async () => {
    const created = await request(app)
      .post('/api/readers')
      .send({ name: 'Анна', contact: 'anna@example.com' });

    expect(created.status).toBe(201);
    expect(created.body).toEqual({ id: 'id1', name: 'Анна', contact: 'anna@example.com' });

    const list = await request(app).get('/api/readers');

    expect(list.status).toBe(200);
    expect(list.body).toEqual([created.body]);
  });

  it('rejects a reader without contact', async () => {
    const res = await request(app).post('/api/readers').send({ name: 'Анна' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/loans', () => {
  it('issues a loan due in 14 days', async () => {
    const bookId = await createBook();
    const readerId = await createReader();

    const res = await checkout(bookId, readerId);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: 'id3',
      bookId,
      readerId,
      issuedAt: '2026-10-17T10:00:00.000Z',
      dueAt: '2026-10-31T10:00:00.000Z',
      returnedAt: null,
    });
  });

  it('rejects loan of unknown book', async () => {
    const res = await checkout('missing', await createReader());

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('BOOK_NOT_FOUND');
  });

  it('rejects loan for unknown reader', async () => {
    const res = await checkout(await createBook(), 'missing');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('READER_NOT_FOUND');
  });

  it('rejects loan without bookId', async () => {
    const res = await request(app).post('/api/loans').send({ readerId: 'r1' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects loan when no free copies left', async () => {
    const bookId = await createBook(1);
    await checkout(bookId, await createReader('Анна'));

    const res = await checkout(bookId, await createReader('Борис'));

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('NO_FREE_COPIES');
  });

  it('rejects loan when reader reached the limit', async () => {
    const readerId = await createReader();
    for (let i = 0; i < 3; i++) {
      expect((await checkout(await createBook(), readerId)).status).toBe(201);
    }

    const res = await checkout(await createBook(), readerId);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('LOAN_LIMIT_REACHED');
  });

  it('issues the last copy only once when requests run concurrently', async () => {
    const bookId = await createBook(1);
    const [anna, boris] = [await createReader('Анна'), await createReader('Борис')];

    const results = await Promise.all([checkout(bookId, anna), checkout(bookId, boris)]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  });
});

describe('POST /api/loans/:id/return', () => {
  it('returns a book and frees the copy', async () => {
    const bookId = await createBook(1);
    const loan = await checkout(bookId, await createReader());
    now = new Date(start.getTime() + 5 * day);

    const res = await request(app).post(`/api/loans/${loan.body.id}/return`);

    expect(res.status).toBe(200);
    expect(res.body.returnedAt).toBe('2026-10-22T10:00:00.000Z');
    expect((await request(app).get('/api/books')).body[0].available).toBe(1);
  });

  it('rejects return of unknown loan', async () => {
    const res = await request(app).post('/api/loans/missing/return');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('LOAN_NOT_FOUND');
  });

  it('rejects blank loan id', async () => {
    const res = await request(app).post('/api/loans/%20/return');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects second return of the same loan', async () => {
    const loan = await checkout(await createBook(), await createReader());
    await request(app).post(`/api/loans/${loan.body.id}/return`);

    const res = await request(app).post(`/api/loans/${loan.body.id}/return`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('LOAN_ALREADY_RETURNED');
  });
});

describe('storage failure', () => {
  it('responds 500 with the storage error code when the data file is corrupted', async () => {
    const file = join(dir, 'corrupted.json');
    await writeFile(file, '{ not json');
    const broken = createApp({ repo: new JsonFileRepository(file) });

    const res = await request(broken).get('/api/books');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INVALID_STORAGE_FILE');
  });
});

describe('GET /api/loans', () => {
  it('marks loan overdue only after the due date', async () => {
    await checkout(await createBook(), await createReader());

    now = new Date(start.getTime() + 14 * day);
    expect((await request(app).get('/api/loans')).body[0].overdue).toBe(false);

    now = new Date(start.getTime() + 15 * day);
    expect((await request(app).get('/api/loans')).body[0].overdue).toBe(true);
  });

  it('filters loans by reader', async () => {
    const anna = await createReader('Анна');
    const boris = await createReader('Борис');
    await checkout(await createBook(), anna);
    await checkout(await createBook(), boris);

    const res = await request(app).get('/api/loans').query({ readerId: boris });

    expect(res.status).toBe(200);
    expect(res.body.map((l: { readerId: string }) => l.readerId)).toEqual([boris]);
  });
});
