import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestBookDraft } from '../../src/server/ai/book-draft.js';
import { createApp } from '../../src/server/app.js';
import type { AiQuota } from '../../src/server/postgres/ai-quota.js';
import type { Storage } from '../../src/server/storage.js';

const API_KEY = 'sk-test-secret-key-12345';
const DRAFT = { title: 'Мастер и Маргарита', author: 'Булгаков', isbn: '', copies: 3 };

const fetchImpl = vi.fn<typeof fetch>();
const quota: AiQuota = { take: () => Promise.resolve(true) };
// Маршрут AI в хранилище не ходит: любой вызов — ошибка теста
const storage: Storage = { run: () => Promise.reject(new Error('хранилище не нужно')) };

function answer(content: string | null, status = 200): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });
}

function makeApp(overrides: { quota?: AiQuota } = {}) {
  return createApp({
    storage,
    ai: {
      apiKey: API_KEY,
      model: 'deepseek-flash',
      dailyLimit: 5,
      quota: overrides.quota ?? quota,
      fetchImpl,
    },
  });
}

function draft(text = 'Мастер и Маргарита, Булгаков, 3 экземпляра') {
  return request(makeApp()).post('/api/ai/book-draft').send({ text });
}

beforeEach(() => {
  // Сеть в тестах запрещена: все вызовы идут только через fetchImpl
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('сеть в тестах запрещена');
    }),
  );
  fetchImpl.mockReset();
  fetchImpl.mockImplementation(() => Promise.resolve(answer(JSON.stringify(DRAFT))));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('requestBookDraft request', () => {
  it('sends a json_object request with limits', async () => {
    const res = await draft('книга про мастера');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(DRAFT);
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe('https://api.deepseek.com/chat/completions');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${API_KEY}`);
    const body = JSON.parse(String(init?.body)) as {
      model: string;
      response_format: unknown;
      thinking: unknown;
      max_tokens: number;
      messages: { role: string; content: string }[];
    };
    expect(body.model).toBe('deepseek-flash');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.thinking).toEqual({ type: 'disabled' });
    expect(body.max_tokens).toBe(300);
    expect(body.messages[0]?.role).toBe('system');
    expect(body.messages[0]?.content).toMatch(/json/);
    expect(body.messages[1]).toEqual({ role: 'user', content: 'книга про мастера' });
  });
});

describe('model answer handling', () => {
  it('rejects an empty answer as AI_BAD_RESPONSE', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchImpl.mockResolvedValue(answer(''));

    const res = await draft();

    expect(res.status).toBe(502);
    expect(res.body.code).toBe('AI_BAD_RESPONSE');
  });

  it('rejects a non-json answer as AI_BAD_RESPONSE', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchImpl.mockResolvedValue(answer('вот ваша книга'));

    const res = await draft();

    expect(res.status).toBe(502);
    expect(res.body.code).toBe('AI_BAD_RESPONSE');
  });

  it.each([
    ['copies 0', { ...DRAFT, copies: 0 }],
    ['no title', { author: 'Булгаков', isbn: '', copies: 1 }],
    ['fractional copies', { ...DRAFT, copies: 1.5 }],
  ])('rejects a draft that fails the schema: %s', async (_name, content) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchImpl.mockResolvedValue(answer(JSON.stringify(content)));

    const res = await draft();

    expect(res.status).toBe(502);
    expect(res.body.code).toBe('AI_BAD_RESPONSE');
  });
});

describe('upstream failures', () => {
  it.each([401, 402, 429, 500])('maps upstream %i to AI_UPSTREAM_ERROR', async (status) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchImpl.mockResolvedValue(new Response('{}', { status }));

    const res = await draft();

    expect(res.status).toBe(502);
    expect(res.body.code).toBe('AI_UPSTREAM_ERROR');
  });

  it('maps a network failure to AI_UPSTREAM_ERROR', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchImpl.mockRejectedValue(new TypeError('fetch failed'));

    const res = await draft();

    expect(res.status).toBe(502);
    expect(res.body.code).toBe('AI_UPSTREAM_ERROR');
  });

  it('maps a timeout to AI_TIMEOUT', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // Как настоящий fetch: ждёт сигнал и отклоняется его причиной (TimeoutError)
    fetchImpl.mockImplementation((_url, init) => {
      const signal = init?.signal as AbortSignal;
      return new Promise<Response>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason));
      });
    });

    await expect(
      requestBookDraft('текст', { apiKey: API_KEY, model: 'm', fetchImpl, timeoutMs: 20 }),
    ).rejects.toMatchObject({ status: 504, code: 'AI_TIMEOUT' });
  });
});

describe('secrets and limits', () => {
  it('never exposes the api key', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const bodies: string[] = [];
    const failures: (() => Promise<Response>)[] = [
      () => Promise.resolve(new Response(`bad key ${API_KEY}`, { status: 401 })),
      () => Promise.reject(new TypeError(`fetch failed for ${API_KEY}`)),
      () => Promise.resolve(answer(`не json ${API_KEY}`)),
      () => Promise.resolve(answer(JSON.stringify({ title: API_KEY }))),
    ];

    for (const failure of failures) {
      fetchImpl.mockImplementationOnce(failure);
      const res = await draft();
      bodies.push(JSON.stringify(res.body));
    }

    expect(bodies.join('')).not.toContain(API_KEY);
    expect(JSON.stringify(errors.mock.calls)).not.toContain(API_KEY);
  });

  it('does not log user text or the model answer', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchImpl.mockResolvedValue(answer('секретный ответ модели'));

    await draft('секретный текст пользователя');

    expect(errors).toHaveBeenCalled();
    expect(JSON.stringify(errors.mock.calls)).not.toContain('секретн');
  });

  it('rejects text longer than 2000 characters', async () => {
    const take = vi.fn(() => Promise.resolve(true));

    const res = await request(makeApp({ quota: { take } }))
      .post('/api/ai/book-draft')
      .send({ text: 'я'.repeat(2001) });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(take).not.toHaveBeenCalled();
  });

  it('rejects a missing text', async () => {
    const res = await request(makeApp()).post('/api/ai/book-draft').send({});

    expect(res.status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not call the model when the quota is exhausted', async () => {
    const res = await request(makeApp({ quota: { take: () => Promise.resolve(false) } }))
      .post('/api/ai/book-draft')
      .send({ text: 'книга' });

    expect(res.status).toBe(429);
    expect(res.body.code).toBe('AI_LIMIT_REACHED');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
