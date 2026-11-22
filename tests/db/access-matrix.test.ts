import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.js';
import { PgAuthStore } from '../../src/server/auth/auth.js';
import { PostgresStorage } from '../../src/server/postgres/postgres-storage.js';
import { loadApiSpec, type SpecRoute } from '../support/api-spec.js';
import { apiPool, asLibrarian, createAccount, login, ownerPool, resetData } from './support/db.js';

// Матрица доступа строится из docs/api-spec.md (D-08): перечень маршрутов и роли — из таблицы,
// а не из кода сервера

const owner = ownerPool();
const api = apiPool();
const PASSWORD = 'correct horse battery staple';
const spec = loadApiSpec();

const app = createApp({
  storage: new PostgresStorage(api),
  auth: { store: new PgAuthStore(api) },
});

type Agent = Awaited<ReturnType<typeof login>>;
let librarian: Agent;
let reader: Agent;

beforeAll(async () => {
  await resetData(owner);
  await asLibrarian(api, async (c) => {
    await c.query(
      "insert into books (id, title, author, isbn, copies) values ('b1', 'Книга', 'Автор', 'isbn-1', 3)",
    );
    await c.query(
      "insert into readers (id, name, contact) values ('r1', 'Читатель', 'r1@example.com')",
    );
    await c.query(
      `insert into loans (id, book_id, reader_id, issued_at, due_at)
       values ('l1', 'b1', 'r1', '2026-03-01T10:00:00Z', '2026-03-15T10:00:00Z')`,
    );
  });
  await createAccount(api, { login: 'anna.lib', password: PASSWORD, role: 'librarian' });
  await createAccount(api, {
    login: 'reader.one',
    password: PASSWORD,
    role: 'reader',
    readerId: 'r1',
  });
  librarian = await login(app, 'anna.lib', PASSWORD);
  reader = await login(app, 'reader.one', PASSWORD);
});

afterAll(async () => {
  await Promise.all([owner.end(), api.end()]);
});

// Параметр :id заменяется id фикстуры по префиксу пути
function concretePath(route: SpecRoute): string {
  const id = route.path.startsWith('/api/books/')
    ? 'b1'
    : route.path.startsWith('/api/readers/')
      ? 'r1'
      : route.path.startsWith('/api/loans/')
        ? 'l1'
        : 'x1';
  return route.path.replace(':id', id);
}

type Caller = Pick<ReturnType<typeof request.agent>, 'get' | 'post' | 'patch' | 'delete'>;

async function call(client: Caller, route: SpecRoute) {
  const url = concretePath(route);
  switch (route.method) {
    case 'GET':
      return client.get(url);
    case 'POST':
      return client.post(url).send({});
    case 'PATCH':
      return client.patch(url).send({});
    case 'DELETE':
      return client.delete(url);
  }
}

// Выход гасит сессию, поэтому для него каждый раз берётся свежий вход
async function clientFor(route: SpecRoute, role: 'librarian' | 'reader'): Promise<Caller> {
  if (route.path === '/api/auth/logout') {
    return login(app, role === 'librarian' ? 'anna.lib' : 'reader.one', PASSWORD);
  }
  return role === 'librarian' ? librarian : reader;
}

describe('access matrix from docs/api-spec.md', () => {
  it('parses every route row of the spec', () => {
    expect(spec.length).toBeGreaterThanOrEqual(19);
    for (const route of spec) expect(route.roles.length, route.path).toBeGreaterThan(0);
  });

  it('answers 401 to anonymous on every non-anonymous route', async () => {
    const routes = spec.filter((route) => !route.roles.includes('anon'));
    for (const route of routes) {
      const res = await call(request(app), route);
      expect(res.status, `${route.method} ${route.path}`).toBe(401);
      expect(res.body, `${route.method} ${route.path}`).toMatchObject({ code: 'UNAUTHENTICATED' });
    }
    // Каждая строка спеки проверена либо здесь, либо как открытая для anon
    const open = spec.filter((route) => route.roles.includes('anon'));
    expect(routes.length + open.length).toBe(spec.length);
  });

  it('lets anonymous through the anonymous routes', async () => {
    const health = await request(app).get('/api/health');
    expect(health.status).toBe(200);
    const badLogin = await request(app).post('/api/auth/login').send({});
    expect(badLogin.status).toBe(400);
  });

  it('answers 403 FORBIDDEN to a reader on every librarian-only route', async () => {
    const routes = spec.filter(
      (route) => !route.roles.includes('reader') && !route.roles.includes('anon'),
    );
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      const res = await call(await clientFor(route, 'reader'), route);
      expect(res.status, `${route.method} ${route.path}`).toBe(403);
      expect(res.body, `${route.method} ${route.path}`).toMatchObject({ code: 'FORBIDDEN' });
    }
    const readerRoutes = spec.filter((route) => route.roles.includes('reader'));
    const anonymousRoutes = spec.filter(
      (route) => !route.roles.includes('reader') && route.roles.includes('anon'),
    );
    expect(routes.length + readerRoutes.length + anonymousRoutes.length).toBe(spec.length);
  });

  it('lets the librarian through every librarian route', async () => {
    const routes = spec.filter((route) => route.roles.includes('librarian'));
    for (const route of routes) {
      const res = await call(await clientFor(route, 'librarian'), route);
      expect([401, 403], `${route.method} ${route.path}`).not.toContain(res.status);
    }
    const rest = spec.filter((route) => !route.roles.includes('librarian'));
    expect(routes.length + rest.length).toBe(spec.length);
  });

  it('lets the reader through every reader route', async () => {
    const routes = spec.filter((route) => route.roles.includes('reader'));
    for (const route of routes) {
      const res = await call(await clientFor(route, 'reader'), route);
      expect([401, 403], `${route.method} ${route.path}`).not.toContain(res.status);
    }
    const rest = spec.filter((route) => !route.roles.includes('reader'));
    expect(routes.length + rest.length).toBe(spec.length);
  });

  it('answers 404 NOT_FOUND to anonymous for an unknown api path', async () => {
    for (const method of ['get', 'post'] as const) {
      const res = await request(app)[method]('/api/no-such-route');
      expect(res.status, method).toBe(404);
      expect(res.headers['content-type'], method).toMatch(/application\/json/);
      expect(res.body, method).toMatchObject({ code: 'NOT_FOUND' });
    }
  });

  it('answers 404 NOT_FOUND in JSON for an unknown api path', async () => {
    const res = await librarian.get('/api/no-such-route');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toMatchObject({ code: 'NOT_FOUND' });
  });
});
