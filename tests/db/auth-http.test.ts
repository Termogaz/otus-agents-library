import { createHash } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.js';
import { PgAuthStore } from '../../src/server/auth/auth.js';
import { hashPassword } from '../../src/server/auth/password.js';
import { buildApp } from '../../src/server/server.js';
import { PostgresStorage } from '../../src/server/postgres/postgres-storage.js';
import { apiPool, asLibrarian, ownerPool, requireTestUrls, resetData } from './support/db.js';

const owner = ownerPool();
const api = apiPool();

const PASSWORD = 'correct horse battery staple';
let passwordHash: string;

beforeAll(async () => {
  // Хеширование намеренно медленное: считаем один раз на весь файл
  passwordHash = await hashPassword(PASSWORD);
});

beforeEach(async () => {
  await resetData(owner);
});

afterAll(async () => {
  await Promise.all([owner.end(), api.end()]);
});

function makeApp() {
  return createApp({
    storage: new PostgresStorage(api),
    auth: { store: new PgAuthStore(api) },
  });
}

// Фикстура идёт через роль приложения с контекстом библиотекаря, минуя маршруты
async function insertLibrarian(login = 'anna.lib'): Promise<void> {
  await asLibrarian(api, (c) =>
    c.query('insert into users (login, password_hash, role) values ($1, $2, $3)', [
      login,
      passwordHash,
      'librarian',
    ]),
  );
}

function setCookies(res: request.Response): string[] {
  const header = res.headers['set-cookie'] as unknown;
  return Array.isArray(header) ? (header as string[]) : [];
}

// Токен из Set-Cookie ответа на вход
function tokenOf(res: request.Response): string {
  const line = setCookies(res).find((cookie) => cookie.startsWith('library_session='));
  const token = line?.split(';')[0]?.slice('library_session='.length);
  if (!token) throw new Error('в ответе нет cookie library_session');
  return token;
}

async function loginAs(app: ReturnType<typeof makeApp>, login: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ login, password: PASSWORD });
  expect(res.status).toBe(200);
  return tokenOf(res);
}

describe('login and session', () => {
  it('logs in a librarian and returns the profile', async () => {
    await insertLibrarian();

    const res = await request(makeApp())
      .post('/api/auth/login')
      .send({ login: 'anna.lib', password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      login: 'anna.lib',
      role: 'librarian',
      readerId: null,
      readerName: null,
    });
    const cookie = setCookies(res).find((line) => line.startsWith('library_session='));
    expect(cookie).toBeDefined();
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
  });

  it('answers 401 UNAUTHENTICATED without a session', async () => {
    const res = await request(makeApp()).get('/api/books');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('serves health without a session', async () => {
    const res = await request(makeApp()).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('rejects a wrong password with INVALID_CREDENTIALS', async () => {
    await insertLibrarian();

    const res = await request(makeApp())
      .post('/api/auth/login')
      .send({ login: 'anna.lib', password: 'a completely wrong password' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
    expect(setCookies(res)).toEqual([]);
  });

  it('stores only a hash of the session token', async () => {
    await insertLibrarian();
    const token = await loginAs(makeApp(), 'anna.lib');

    const { rows } = await owner.query<{ token_hash: string }>('select token_hash from sessions');

    expect(rows).toHaveLength(1);
    expect(rows[0]?.token_hash).not.toBe(token);
    expect(rows[0]?.token_hash).toBe(createHash('sha256').update(token).digest('hex'));
  });

  it('issues a new token on every login', async () => {
    await insertLibrarian();
    const app = makeApp();

    const first = await loginAs(app, 'anna.lib');
    const second = await loginAs(app, 'anna.lib');

    expect(second).not.toBe(first);
  });

  it('lets a session see its profile and data', async () => {
    await insertLibrarian();
    const app = makeApp();
    const token = await loginAs(app, 'anna.lib');

    const me = await request(app).get('/api/auth/me').set('Cookie', `library_session=${token}`);
    const books = await request(app)
      .get('/api/books')
      .set('Cookie', `other=1; library_session=${token}`);

    expect(me.status).toBe(200);
    expect(me.body.login).toBe('anna.lib');
    expect(books.status).toBe(200);
    expect(books.body).toEqual([]);
  });

  it('logs out and invalidates the session', async () => {
    await insertLibrarian();
    const app = makeApp();
    const token = await loginAs(app, 'anna.lib');
    const cookie = `library_session=${token}`;

    const logout = await request(app).post('/api/auth/logout').set('Cookie', cookie);

    expect(logout.status).toBe(204);
    expect(setCookies(logout).some((line) => line.startsWith('library_session=;'))).toBe(true);
    const after = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(after.status).toBe(401);
    const { rows } = await owner.query('select 1 from sessions');
    expect(rows).toHaveLength(0);
  });
});

describe('login protection', () => {
  async function failLogin(app: ReturnType<typeof makeApp>, login: string, password: string) {
    return request(app).post('/api/auth/login').send({ login, password });
  }

  it('answers the same for unknown login and wrong password', async () => {
    await insertLibrarian();
    const app = makeApp();

    const unknown = await failLogin(app, 'nobody.here', 'a completely wrong password');
    const wrong = await failLogin(app, 'anna.lib', 'a completely wrong password');

    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body).toEqual(wrong.body);
    expect(unknown.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('blocks the sixth failed attempt for a login', async () => {
    await insertLibrarian();
    const app = makeApp();

    for (let i = 0; i < 5; i += 1) {
      const res = await failLogin(app, 'anna.lib', 'a completely wrong password');
      expect(res.status).toBe(401);
    }
    // Даже верный пароль после пяти неудач не принимается
    const sixth = await failLogin(app, 'anna.lib', PASSWORD);

    expect(sixth.status).toBe(429);
    expect(sixth.body.code).toBe('TOO_MANY_ATTEMPTS');
    expect(setCookies(sixth)).toEqual([]);
  });

  it('does not block another login', async () => {
    await insertLibrarian();
    await insertLibrarian('boris.lib');
    const app = makeApp();
    for (let i = 0; i < 5; i += 1) await failLogin(app, 'anna.lib', 'a completely wrong password');

    const other = await failLogin(app, 'boris.lib', PASSWORD);

    expect(other.status).toBe(200);
  });

  it('rejects an expired session', async () => {
    await insertLibrarian();
    const app = makeApp();
    const { rows } = await owner.query<{ id: string }>('select id from users');
    await owner.query(
      "insert into sessions (token_hash, user_id, expires_at) values ($1, $2, now() - interval '1 minute')",
      [createHash('sha256').update('expired-token').digest('hex'), rows[0]?.id],
    );

    const res = await request(app).get('/api/books').set('Cookie', 'library_session=expired-token');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('marks the cookie Secure behind an HTTPS proxy', async () => {
    await insertLibrarian();
    const app = makeApp();
    app.set('trust proxy', 1);

    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-Proto', 'https')
      .send({ login: 'anna.lib', password: PASSWORD });

    expect(res.status).toBe(200);
    expect(setCookies(res)[0]).toMatch(/; Secure/);
  });

  it('does not mark the cookie Secure on plain http', async () => {
    await insertLibrarian();

    const res = await request(makeApp())
      .post('/api/auth/login')
      .send({ login: 'anna.lib', password: PASSWORD });

    expect(res.status).toBe(200);
    expect(setCookies(res)[0]).not.toMatch(/; Secure/);
  });

  it('enables login in postgres mode of buildApp', async () => {
    const { app, close } = buildApp({
      storage: 'postgres',
      databaseUrl: requireTestUrls().apiUrl,
      port: 3000,
      dataFile: 'unused.json',
    });
    try {
      const res = await request(app).get('/api/books');

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHENTICATED');
    } finally {
      await close();
    }
  });
});
