import { spawnSync } from 'node:child_process';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.js';
import { PgAuthStore } from '../../src/server/auth/auth.js';
import { PostgresStorage } from '../../src/server/postgres/postgres-storage.js';
import {
  type AccountInput,
  apiPool,
  asLibrarian,
  createAccount,
  login,
  ownerPool,
  requireTestUrls,
  resetData,
} from './support/db.js';

const owner = ownerPool();
const api = apiPool();

const PASSWORD = 'correct horse battery staple';
const ROOT = path.resolve(import.meta.dirname, '../..');

let app: ReturnType<typeof makeApp>;

function makeApp() {
  return createApp({
    storage: new PostgresStorage(api),
    auth: { store: new PgAuthStore(api) },
  });
}

beforeEach(async () => {
  await resetData(owner);
  app = makeApp();
  await createAccount(api, { login: 'anna.lib', password: PASSWORD, role: 'librarian' });
});

afterAll(async () => {
  await Promise.all([owner.end(), api.end()]);
});

async function insertReader(id: string): Promise<void> {
  await asLibrarian(api, (c) =>
    c.query('insert into readers (id, name, contact) values ($1, $2, $3)', [
      id,
      `Читатель ${id}`,
      `${id}@example.com`,
    ]),
  );
}

async function librarian() {
  return login(app, 'anna.lib', PASSWORD);
}

const readerAccount = (readerId: string, loginName = 'reader.one'): AccountInput => ({
  login: loginName,
  password: PASSWORD,
  role: 'reader',
  readerId,
});

describe('POST /api/users', () => {
  it('creates a reader account linked to a reader', async () => {
    await insertReader('r1');
    const agent = await librarian();

    const res = await agent.post('/api/users').send(readerAccount('r1'));

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      login: 'reader.one',
      role: 'reader',
      readerId: 'r1',
    });
    expect(JSON.stringify(res.body)).not.toContain('password');
    const { rows } = await owner.query<{ password_hash: string }>(
      "select password_hash from users where login = 'reader.one'",
    );
    expect(rows[0]?.password_hash).toMatch(/^scrypt\$/);
    expect(rows[0]?.password_hash).not.toContain(PASSWORD);
  });

  it('rejects a duplicate login with LOGIN_TAKEN', async () => {
    await insertReader('r1');
    await insertReader('r2');
    const agent = await librarian();
    await agent.post('/api/users').send(readerAccount('r1'));

    const res = await agent.post('/api/users').send(readerAccount('r2'));

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('LOGIN_TAKEN');
  });

  it('rejects a second account for the same reader with READER_ALREADY_HAS_ACCOUNT', async () => {
    await insertReader('r1');
    const agent = await librarian();
    await agent.post('/api/users').send(readerAccount('r1'));

    const res = await agent.post('/api/users').send(readerAccount('r1', 'reader.two'));

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('READER_ALREADY_HAS_ACCOUNT');
  });

  it('answers 404 READER_NOT_FOUND for an unknown reader', async () => {
    const agent = await librarian();

    const res = await agent.post('/api/users').send(readerAccount('ghost'));

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('READER_NOT_FOUND');
  });

  it('requires readerId exactly for the reader role', async () => {
    await insertReader('r1');
    const agent = await librarian();

    const readerWithout = await agent
      .post('/api/users')
      .send({ login: 'reader.one', password: PASSWORD, role: 'reader' });
    const librarianWith = await agent
      .post('/api/users')
      .send({ login: 'boris.lib', password: PASSWORD, role: 'librarian', readerId: 'r1' });

    expect(readerWithout.status).toBe(400);
    expect(readerWithout.body.code).toBe('VALIDATION_ERROR');
    expect(librarianWith.status).toBe(400);
    expect(librarianWith.body.code).toBe('VALIDATION_ERROR');
  });

  it('creates a librarian account without a reader', async () => {
    const agent = await librarian();

    const res = await agent
      .post('/api/users')
      .send({ login: 'Boris.Lib', password: PASSWORD, role: 'librarian' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ login: 'boris.lib', role: 'librarian', readerId: null });
  });

  it('forbids creating accounts to a reader', async () => {
    await insertReader('r1');
    await createAccount(api, readerAccount('r1'));
    const reader = await login(app, 'reader.one', PASSWORD);

    const res = await reader
      .post('/api/users')
      .send({ login: 'sneaky.lib', password: PASSWORD, role: 'librarian' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('answers 401 without a session', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ login: 'sneaky.lib', password: PASSWORD, role: 'librarian' });

    expect(res.status).toBe(401);
  });

  it('lets the new reader log in and see own profile', async () => {
    await insertReader('r1');
    const agent = await librarian();
    await agent.post('/api/users').send(readerAccount('r1'));

    const reader = await login(app, 'reader.one', PASSWORD);
    const me = await reader.get('/api/auth/me');

    expect(me.status).toBe(200);
    expect(me.body).toEqual({
      login: 'reader.one',
      role: 'reader',
      readerId: 'r1',
      readerName: 'Читатель r1',
    });
  });
});

describe('account storage', () => {
  it('never exposes password_hash to the api role', async () => {
    await expect(api.query('select password_hash from users')).rejects.toMatchObject({
      code: '42501',
    });
  });

  it('keeps sessions closed to the api role', async () => {
    await expect(api.query('select token_hash from sessions')).rejects.toMatchObject({
      code: '42501',
    });
  });

  it('removes the reader account together with the reader', async () => {
    await insertReader('r1');
    await createAccount(api, readerAccount('r1'));
    await login(app, 'reader.one', PASSWORD);
    const agent = await librarian();

    const res = await agent.delete('/api/readers/r1');

    expect(res.status).toBe(204);
    const users = await owner.query("select 1 from users where login = 'reader.one'");
    expect(users.rows).toHaveLength(0);
    // Остаётся только сессия библиотекаря
    const sessions = await owner.query('select 1 from sessions');
    expect(sessions.rows).toHaveLength(1);
  });
});

describe('create-user command', () => {
  // Без оболочки и без npx: на Windows обёртка npx без оболочки не запускается (ENOENT),
  // а оболочка с подставленными аргументами недопустима
  function runCli(args: string[], input: string) {
    return spawnSync(
      process.execPath,
      [
        path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
        'src/server/cli/create-user.ts',
        ...args,
      ],
      {
        input,
        encoding: 'utf8',
        cwd: ROOT,
        env: { ...process.env, DATABASE_URL: requireTestUrls().apiUrl },
      },
    );
  }

  it('creates the first librarian from the command line', async () => {
    const result = runCli(['--login', 'admin', '--role', 'librarian'], PASSWORD);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('admin');
    expect(result.stdout + result.stderr).not.toContain(PASSWORD);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ login: 'admin', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('librarian');
  });

  it('strips the trailing newline of the piped password', async () => {
    const result = runCli(['--login', 'carol', '--role', 'librarian'], `${PASSWORD}\n`);

    expect(result.status, result.stderr).toBe(0);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ login: 'carol', password: PASSWORD });
    expect(res.status).toBe(200);
  });

  it('fails on a short password without echoing it', () => {
    const result = runCli(['--login', 'dave', '--role', 'librarian'], 'tiny-1');

    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).not.toContain('tiny-1');
  });
});
