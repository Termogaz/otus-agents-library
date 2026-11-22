import { createHash } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.js';
import { PgAuthStore } from '../../src/server/auth/auth.js';
import { PostgresStorage } from '../../src/server/postgres/postgres-storage.js';
import type { RequestContext } from '../../src/server/storage.js';
import {
  apiPool,
  asAnonymous,
  asContext,
  asLibrarian,
  createAccount,
  login,
  ownerPool,
  resetData,
} from './support/db.js';

const owner = ownerPool();
const api = apiPool();

const PASSWORD = 'correct horse battery staple';
const DUE = new Date('2026-03-15T10:00:00.000Z');
const ISSUED = new Date('2026-03-01T10:00:00.000Z');

let readerOneUser = '';
let readerTwoUser = '';
let readerCtx: RequestContext;

beforeEach(async () => {
  await resetData(owner);
  await asLibrarian(api, async (c) => {
    for (const id of ['b1', 'b2']) {
      await c.query(
        'insert into books (id, title, author, isbn, copies) values ($1, $2, $3, $4, 5)',
        [id, `Книга ${id}`, 'Автор', `isbn-${id}`],
      );
    }
    for (const id of ['r1', 'r2']) {
      await c.query('insert into readers (id, name, contact) values ($1, $2, $3)', [
        id,
        `Читатель ${id}`,
        `${id}@example.com`,
      ]);
    }
    await c.query(
      'insert into loans (id, book_id, reader_id, issued_at, due_at) values ($1, $2, $3, $4, $5)',
      ['l1', 'b1', 'r1', ISSUED, DUE],
    );
    await c.query(
      'insert into loans (id, book_id, reader_id, issued_at, due_at) values ($1, $2, $3, $4, $5)',
      ['l2', 'b2', 'r2', ISSUED, DUE],
    );
  });
  readerOneUser = await createAccount(api, {
    login: 'reader.one',
    password: PASSWORD,
    role: 'reader',
    readerId: 'r1',
  });
  readerTwoUser = await createAccount(api, {
    login: 'reader.two',
    password: PASSWORD,
    role: 'reader',
    readerId: 'r2',
  });
  readerCtx = { userId: readerOneUser, role: 'reader', readerId: 'r1' };
});

afterAll(async () => {
  await Promise.all([owner.end(), api.end()]);
});

const ids = (rows: { id: string }[]) => rows.map((row) => row.id);

describe('row level security for a reader', () => {
  it('shows a reader only own loans', async () => {
    const { rows } = await asContext(api, readerCtx, (c) =>
      c.query<{ id: string }>('select id from loans order by id'),
    );
    expect(ids(rows)).toEqual(['l1']);
  });

  it('shows a reader only own reader row', async () => {
    const { rows } = await asContext(api, readerCtx, (c) =>
      c.query<{ id: string }>('select id from readers order by id'),
    );
    expect(ids(rows)).toEqual(['r1']);
  });

  it('shows a reader only own account in users', async () => {
    const { rows } = await asContext(api, readerCtx, (c) =>
      c.query<{ id: string }>('select id from users order by id'),
    );
    expect(ids(rows)).toEqual([readerOneUser]);
    expect(readerOneUser).not.toBe(readerTwoUser);
  });

  it('shows a reader the whole catalog', async () => {
    const { rows } = await asContext(api, readerCtx, (c) =>
      c.query<{ id: string }>('select id from books order by id'),
    );
    expect(ids(rows)).toEqual(['b1', 'b2']);
  });

  it('rejects inserts by a reader', async () => {
    await expect(
      asContext(api, readerCtx, (c) =>
        c.query(
          "insert into books (id, title, author, isbn, copies) values ('b3', 'Т', 'А', 'i', 1)",
        ),
      ),
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('ignores updates and deletes by a reader', async () => {
    const updated = await asContext(api, readerCtx, (c) => c.query('update books set copies = 99'));
    const deleted = await asContext(api, readerCtx, (c) => c.query('delete from loans'));
    expect(updated.rowCount).toBe(0);
    expect(deleted.rowCount).toBe(0);

    const books = await owner.query<{ copies: number }>('select copies from books order by id');
    expect(books.rows.map((row) => row.copies)).toEqual([5, 5]);
    const loans = await owner.query('select id from loans');
    expect(loans.rowCount).toBe(2);
  });
});

describe('row level security without a role', () => {
  it('shows no rows without a role', async () => {
    for (const table of ['books', 'readers', 'loans', 'users']) {
      const { rows } = await asAnonymous(api, (c) => c.query(`select * from ${table}`));
      expect(rows, table).toEqual([]);
    }
  });

  it('rejects writes without a role', async () => {
    await expect(
      asAnonymous(api, (c) =>
        c.query(
          "insert into books (id, title, author, isbn, copies) values ('b3', 'Т', 'А', 'i', 1)",
        ),
      ),
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('survives a non-uuid user id in the context', async () => {
    const odd: RequestContext = { userId: 'not-a-uuid', role: 'reader', readerId: 'r1' };
    const { rows } = await asContext(api, odd, (c) => c.query('select id from users'));
    expect(rows).toEqual([]);
  });
});

describe('row level security for a librarian', () => {
  it('lets a librarian read and write every table', async () => {
    const librarian: RequestContext = { userId: null, role: 'librarian', readerId: null };
    const loans = await asContext(api, librarian, (c) => c.query('select id from loans'));
    const readers = await asContext(api, librarian, (c) => c.query('select id from readers'));
    const users = await asContext(api, librarian, (c) => c.query('select id from users'));
    expect(loans.rowCount).toBe(2);
    expect(readers.rowCount).toBe(2);
    expect(users.rowCount).toBe(2);
    const updated = await asContext(api, librarian, (c) =>
      c.query("update books set copies = 7 where id = 'b1'"),
    );
    expect(updated.rowCount).toBe(1);
  });
});

describe('definer functions under FORCE', () => {
  it('keeps definer functions working under FORCE', async () => {
    const token = createHash('sha256').update('rls-token').digest('hex');
    await api.query('select auth_create_session($1, $2, $3)', [
      token,
      readerOneUser,
      new Date(Date.now() + 60_000),
    ]);

    // Поиск сессии идёт без контекста: пользователь ещё неизвестен
    const session = await asAnonymous(api, (c) =>
      c.query<{ user_id: string; role: string }>(
        'select user_id, role from auth_resolve_session($1)',
        [token],
      ),
    );
    expect(session.rows).toEqual([{ user_id: readerOneUser, role: 'reader' }]);

    const found = await asAnonymous(api, (c) =>
      c.query('select user_id from auth_find_user_for_login($1)', ['reader.one']),
    );
    expect(found.rowCount).toBe(1);

    // Читатель видит доступность, считанную по всем выдачам, а не только по своим
    const counts = await asContext(api, readerCtx, (c) =>
      c.query<{ book_id: string; active: number }>(
        'select book_id, active from active_loan_counts() order by book_id',
      ),
    );
    expect(counts.rows).toEqual([
      { book_id: 'b1', active: 1 },
      { book_id: 'b2', active: 1 },
    ]);
  });
});

describe('role setup', () => {
  it('forces RLS on data tables', async () => {
    const { rows } = await owner.query<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(
      `select relname, relrowsecurity, relforcerowsecurity from pg_class
       where relname in ('books', 'readers', 'loans', 'users') and relkind = 'r'
       order by relname`,
    );
    expect(rows.map((row) => row.relname)).toEqual(['books', 'loans', 'readers', 'users']);
    for (const row of rows) {
      expect(row.relrowsecurity, row.relname).toBe(true);
      expect(row.relforcerowsecurity, row.relname).toBe(true);
    }
  });

  it('keeps the api role without BYPASSRLS', async () => {
    const role = await owner.query<{ rolbypassrls: boolean; rolsuper: boolean }>(
      "select rolbypassrls, rolsuper from pg_roles where rolname = 'library_api'",
    );
    expect(role.rows).toEqual([{ rolbypassrls: false, rolsuper: false }]);
    const owned = await owner.query(
      "select 1 from pg_tables where schemaname = 'public' and tableowner = 'library_api'",
    );
    expect(owned.rowCount).toBe(0);
  });
});

describe('row level security over HTTP', () => {
  it('returns only own loans to a reader over HTTP', async () => {
    const app = createApp({
      storage: new PostgresStorage(api),
      auth: { store: new PgAuthStore(api) },
    });
    const agent = await login(app, 'reader.one', PASSWORD);

    const own = await agent.get('/api/loans');
    expect(own.status).toBe(200);
    expect((own.body as { id: string }[]).map((loan) => loan.id)).toEqual(['l1']);

    const foreign = await agent.get('/api/loans?readerId=r2');
    expect(foreign.status).toBe(200);
    expect(foreign.body).toEqual([]);
  });
});
