import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.js';
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

const NOW = new Date('2026-03-01T10:00:00.000Z');

// Фикстуры идут напрямую через роль приложения, минуя маршруты
async function insertBook(id: string, copies: number): Promise<void> {
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

async function insertLoan(id: string, bookId: string, readerId: string): Promise<void> {
  await asLibrarian(api, (c) =>
    c.query(
      `insert into loans (id, book_id, reader_id, issued_at, due_at, returned_at)
       values ($1, $2, $3, $4, $5, null)`,
      [id, bookId, readerId, NOW, new Date(NOW.getTime() + 14 * 24 * 3600 * 1000)],
    ),
  );
}

// Третье соединение: держит блокировку строки, пока тест не отпустит её сам
async function holdLock(sql: string, id: string): Promise<pg.Client> {
  const holder = new pg.Client({ connectionString: requireTestUrls().apiUrl });
  await holder.connect();
  await holder.query('begin');
  await holder.query("select set_config('app.role', 'librarian', true)");
  await holder.query(sql, [id]);
  return holder;
}

// Ждёт, пока в БД будет не меньше двух транзакций, остановленных на блокировке строки.
// Фиксированной паузы нет: опрос pg_stat_activity с верхним пределом по времени.
async function waitForTwoLockWaiters(): Promise<void> {
  const deadline = Date.now() + 5000;
  for (;;) {
    const { rows } = await api.query<{ n: number }>(
      `select count(*)::int as n from pg_stat_activity
       where datname = current_database() and wait_event_type = 'Lock'`,
    );
    if ((rows[0]?.n ?? 0) >= 2) return;
    if (Date.now() > deadline) throw new Error('запросы не ждали блокировку книги');
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function makeApp() {
  let seq = 0;
  return createApp({
    storage: new PostgresStorage(api),
    now: () => NOW,
    newId: () => `loan${++seq}`,
  });
}

describe('concurrent checkout', () => {
  it('issues the last copy once when two checkouts race', async () => {
    await insertBook('b1', 1);
    await insertReader('r1');
    await insertReader('r2');
    const app = makeApp();

    const holder = await holdLock('select id from books where id = $1 for update', 'b1');
    try {
      const first = request(app).post('/api/loans').send({ bookId: 'b1', readerId: 'r1' }).then();
      const second = request(app).post('/api/loans').send({ bookId: 'b1', readerId: 'r2' }).then();
      await waitForTwoLockWaiters();
      await holder.query('commit');
      const responses = await Promise.all([first, second]);

      const statuses = responses.map((r) => r.status).sort();
      expect(statuses).toEqual([201, 409]);
      const refused = responses.find((r) => r.status === 409);
      expect(refused?.body.code).toBe('NO_FREE_COPIES');

      const { rows } = await owner.query<{ n: number }>(
        'select count(*)::int as n from loans where returned_at is null',
      );
      expect(rows[0]?.n).toBe(1);
    } finally {
      await holder.query('rollback').catch(() => {});
      await holder.end();
    }
  });

  it('returns a loan once when two returns race', async () => {
    await insertBook('b1', 1);
    await insertReader('r1');
    await insertLoan('l1', 'b1', 'r1');
    const app = makeApp();

    const holder = await holdLock('select id from loans where id = $1 for update', 'l1');
    try {
      const first = request(app).post('/api/loans/l1/return').send().then();
      const second = request(app).post('/api/loans/l1/return').send().then();
      await waitForTwoLockWaiters();
      await holder.query('commit');
      const responses = await Promise.all([first, second]);

      const statuses = responses.map((r) => r.status).sort();
      expect(statuses).toEqual([200, 409]);
      const refused = responses.find((r) => r.status === 409);
      expect(refused?.body.code).toBe('LOAN_ALREADY_RETURNED');
    } finally {
      await holder.query('rollback').catch(() => {});
      await holder.end();
    }
  });
});

describe('loan scenario on Postgres', () => {
  const DAY_MS = 24 * 3600 * 1000;

  // Часы можно двигать вперёд: так проверяется просрочка
  function scenarioApp() {
    const clock = { now: NOW };
    let seq = 0;
    const app = createApp({
      storage: new PostgresStorage(api),
      now: () => clock.now,
      newId: () => `loan${++seq}`,
    });
    return { app, clock };
  }

  async function availableOf(app: ReturnType<typeof createApp>, bookId: string): Promise<number> {
    const { body } = await request(app).get('/api/books');
    return (body as { id: string; available: number }[]).find((b) => b.id === bookId)!.available;
  }

  it('issues a loan due in 14 days', async () => {
    await insertBook('b1', 2);
    await insertReader('r1');
    const { app } = scenarioApp();

    const res = await request(app).post('/api/loans').send({ bookId: 'b1', readerId: 'r1' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: 'loan1',
      bookId: 'b1',
      readerId: 'r1',
      issuedAt: NOW.toISOString(),
      dueAt: new Date(NOW.getTime() + 14 * DAY_MS).toISOString(),
      returnedAt: null,
    });
    expect(await availableOf(app, 'b1')).toBe(1);
  });

  it('rejects the fourth loan when reader reached the limit', async () => {
    for (const id of ['b1', 'b2', 'b3', 'b4']) await insertBook(id, 1);
    await insertReader('r1');
    const { app } = scenarioApp();

    for (const bookId of ['b1', 'b2', 'b3']) {
      const ok = await request(app).post('/api/loans').send({ bookId, readerId: 'r1' });
      expect(ok.status).toBe(201);
    }
    const res = await request(app).post('/api/loans').send({ bookId: 'b4', readerId: 'r1' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('LOAN_LIMIT_REACHED');
  });

  it('rejects a loan when no free copies left', async () => {
    await insertBook('b1', 1);
    await insertReader('r1');
    await insertReader('r2');
    const { app } = scenarioApp();

    await request(app).post('/api/loans').send({ bookId: 'b1', readerId: 'r1' });
    const res = await request(app).post('/api/loans').send({ bookId: 'b1', readerId: 'r2' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('NO_FREE_COPIES');
  });

  it('returns a loan and frees the copy', async () => {
    await insertBook('b1', 1);
    await insertReader('r1');
    const { app, clock } = scenarioApp();
    await request(app).post('/api/loans').send({ bookId: 'b1', readerId: 'r1' });
    expect(await availableOf(app, 'b1')).toBe(0);

    clock.now = new Date(NOW.getTime() + 3 * DAY_MS);
    const res = await request(app).post('/api/loans/loan1/return').send();

    expect(res.status).toBe(200);
    expect(res.body.returnedAt).toBe(clock.now.toISOString());
    expect(await availableOf(app, 'b1')).toBe(1);
  });

  it('rejects a repeated return', async () => {
    await insertBook('b1', 1);
    await insertReader('r1');
    const { app } = scenarioApp();
    await request(app).post('/api/loans').send({ bookId: 'b1', readerId: 'r1' });
    await request(app).post('/api/loans/loan1/return').send();

    const res = await request(app).post('/api/loans/loan1/return').send();

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('LOAN_ALREADY_RETURNED');
  });

  it('marks a loan overdue after the due date', async () => {
    await insertBook('b1', 1);
    await insertReader('r1');
    const { app, clock } = scenarioApp();
    await request(app).post('/api/loans').send({ bookId: 'b1', readerId: 'r1' });

    const before = await request(app).get('/api/loans');
    expect(before.body[0].overdue).toBe(false);

    clock.now = new Date(NOW.getTime() + 15 * DAY_MS);
    const after = await request(app).get('/api/loans');
    expect(after.body[0].overdue).toBe(true);
  });

  it('answers 404 for unknown book, reader and loan', async () => {
    await insertBook('b1', 1);
    await insertReader('r1');
    const { app } = scenarioApp();

    const noBook = await request(app).post('/api/loans').send({ bookId: 'nope', readerId: 'r1' });
    const noReader = await request(app).post('/api/loans').send({ bookId: 'b1', readerId: 'nope' });
    const noLoan = await request(app).post('/api/loans/nope/return').send();

    expect([noBook.status, noBook.body.code]).toEqual([404, 'BOOK_NOT_FOUND']);
    expect([noReader.status, noReader.body.code]).toEqual([404, 'READER_NOT_FOUND']);
    expect([noLoan.status, noLoan.body.code]).toEqual([404, 'LOAN_NOT_FOUND']);
  });

  it('filters loans by reader and by book', async () => {
    await insertBook('b1', 2);
    await insertBook('b2', 2);
    await insertReader('r1');
    await insertReader('r2');
    const { app } = scenarioApp();
    await request(app).post('/api/loans').send({ bookId: 'b1', readerId: 'r1' });
    await request(app).post('/api/loans').send({ bookId: 'b2', readerId: 'r1' });
    await request(app).post('/api/loans').send({ bookId: 'b1', readerId: 'r2' });

    const byReader = await request(app).get('/api/loans').query({ readerId: 'r1' });
    const byBook = await request(app).get('/api/loans').query({ bookId: 'b1' });

    expect(byReader.body.map((l: { id: string }) => l.id)).toEqual(['loan1', 'loan2']);
    expect(byBook.body.map((l: { id: string }) => l.id)).toEqual(['loan1', 'loan3']);
  });
});
