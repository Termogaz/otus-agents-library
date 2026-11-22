import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/server/app.js';
import { PgAuthStore } from '../../src/server/auth/auth.js';
import { PgAiQuota } from '../../src/server/postgres/ai-quota.js';
import { PostgresStorage } from '../../src/server/postgres/postgres-storage.js';
import { apiPool, asContext, createAccount, login, ownerPool, resetData } from './support/db.js';

const owner = ownerPool();
const api = apiPool();

const PASSWORD = 'correct horse battery staple';
const DRAFT = { title: 'Мастер и Маргарита', author: 'Булгаков', isbn: '', copies: 3 };

// Подмена сети: ответ модели с готовым черновиком; в сеть тесты не ходят
const fetchImpl = vi.fn<typeof fetch>();

function modelAnswer(content: unknown): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

function makeApp(withAi = true) {
  return createApp({
    storage: new PostgresStorage(api),
    auth: { store: new PgAuthStore(api) },
    ...(withAi
      ? {
          ai: {
            apiKey: 'test-key',
            model: 'deepseek-flash',
            dailyLimit: 2,
            quota: new PgAiQuota(api),
            fetchImpl,
          },
        }
      : {}),
  });
}

let annaId: string;

beforeEach(async () => {
  await resetData(owner);
  fetchImpl.mockReset();
  fetchImpl.mockImplementation(() => Promise.resolve(modelAnswer(DRAFT)));
  annaId = await createAccount(api, { login: 'anna.lib', password: PASSWORD, role: 'librarian' });
  await createAccount(api, { login: 'boris.lib', password: PASSWORD, role: 'librarian' });
});

afterAll(async () => {
  await Promise.all([owner.end(), api.end()]);
});

describe('POST /api/ai/book-draft', () => {
  it('returns a draft parsed from the model answer', async () => {
    const librarian = await login(makeApp(), 'anna.lib', PASSWORD);

    const res = await librarian
      .post('/api/ai/book-draft')
      .send({ text: 'Мастер и Маргарита, Булгаков, 3 экземпляра' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(DRAFT);
    const { rows } = await owner.query<{ count: string }>('select count(*) from books');
    expect(rows[0]?.count).toBe('0');
  });

  it('limits requests per user per day', async () => {
    const librarian = await login(makeApp(), 'anna.lib', PASSWORD);
    const call = () => librarian.post('/api/ai/book-draft').send({ text: 'книга' });

    expect((await call()).status).toBe(200);
    expect((await call()).status).toBe(200);
    const third = await call();

    expect(third.status).toBe(429);
    expect(third.body.code).toBe('AI_LIMIT_REACHED');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('counts usage separately for each librarian', async () => {
    const app = makeApp();
    const anna = await login(app, 'anna.lib', PASSWORD);
    const boris = await login(app, 'boris.lib', PASSWORD);
    await anna.post('/api/ai/book-draft').send({ text: 'книга' });
    await anna.post('/api/ai/book-draft').send({ text: 'книга' });
    expect((await anna.post('/api/ai/book-draft').send({ text: 'книга' })).status).toBe(429);

    const res = await boris.post('/api/ai/book-draft').send({ text: 'книга' });

    expect(res.status).toBe(200);
  });

  it('hides ai usage of other users', async () => {
    const app = makeApp();
    const anna = await login(app, 'anna.lib', PASSWORD);
    const boris = await login(app, 'boris.lib', PASSWORD);
    await anna.post('/api/ai/book-draft').send({ text: 'книга' });
    await boris.post('/api/ai/book-draft').send({ text: 'книга' });

    const own = await asContext(api, { userId: annaId, role: 'librarian', readerId: null }, (c) =>
      c.query<{ count: string }>('select count(*) from ai_usage'),
    );
    const all = await owner.query<{ count: string }>('select count(*) from ai_usage');

    expect(own.rows[0]?.count).toBe('1');
    expect(all.rows[0]?.count).toBe('2');
  });

  it('answers 503 AI_DISABLED without ai settings', async () => {
    const librarian = await login(makeApp(false), 'anna.lib', PASSWORD);

    const res = await librarian.post('/api/ai/book-draft').send({ text: 'книга' });

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('AI_DISABLED');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
