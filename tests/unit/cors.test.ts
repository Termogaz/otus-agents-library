import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.js';
import { JsonFileRepository } from '../../src/server/json-file-repository.js';

const LISTED = 'https://ok.example';
const FOREIGN = 'https://evil.example';
const book = { title: 'Книга', author: 'Автор', isbn: '1', copies: 1 };

let dir: string;
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'library-cors-'));
  app = createApp({
    repo: new JsonFileRepository(join(dir, 'library.json')),
    cors: { allowedOrigins: new Set([LISTED]) },
  });
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('CORS', () => {
  it('allows a listed origin with credentials', async () => {
    const res = await request(app).get('/api/health').set('Origin', LISTED);

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(LISTED);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers.vary).toMatch(/Origin/);
  });

  it('answers preflight for a listed origin with 204', async () => {
    const res = await request(app)
      .options('/api/books')
      .set('Origin', LISTED)
      .set('Access-Control-Request-Method', 'POST');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(LISTED);
    expect(res.headers['access-control-allow-methods']).toBe('GET,POST,PATCH,DELETE,OPTIONS');
    expect(res.headers['access-control-allow-headers']).toBe('Content-Type');
  });

  it('sends no CORS headers to an unlisted origin', async () => {
    const res = await request(app).get('/api/health').set('Origin', FOREIGN);

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('never answers with a wildcard origin', async () => {
    for (const origin of [LISTED, FOREIGN, '*', 'null']) {
      const res = await request(app).get('/api/health').set('Origin', origin);
      expect(res.headers['access-control-allow-origin']).not.toBe('*');
    }
    const none = await request(app).get('/api/health');
    expect(none.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('does not answer preflight from an unlisted origin with CORS headers', async () => {
    const res = await request(app)
      .options('/api/books')
      .set('Origin', FOREIGN)
      .set('Access-Control-Request-Method', 'POST');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('Origin check on writes', () => {
  it('rejects writes from a foreign origin with ORIGIN_NOT_ALLOWED', async () => {
    const res = await request(app).post('/api/books').set('Origin', FOREIGN).send(book);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ORIGIN_NOT_ALLOWED');
  });

  it('rejects PATCH and DELETE from a foreign origin', async () => {
    const patch = await request(app).patch('/api/books/x').set('Origin', FOREIGN).send({});
    const del = await request(app).delete('/api/books/x').set('Origin', FOREIGN);

    expect(patch.status).toBe(403);
    expect(patch.body.code).toBe('ORIGIN_NOT_ALLOWED');
    expect(del.status).toBe(403);
    expect(del.body.code).toBe('ORIGIN_NOT_ALLOWED');
  });

  it('rejects a malformed Origin on writes', async () => {
    const res = await request(app).post('/api/books').set('Origin', 'not a url').send(book);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ORIGIN_NOT_ALLOWED');
  });

  it('allows same-origin writes', async () => {
    const res = await request(app)
      .post('/api/books')
      .set('Host', 'library.example')
      .set('Origin', 'https://library.example')
      .send(book);

    expect(res.status).toBe(201);
  });

  it('allows writes from a listed origin', async () => {
    const res = await request(app).post('/api/books').set('Origin', LISTED).send(book);

    expect(res.status).toBe(201);
    expect(res.headers['access-control-allow-origin']).toBe(LISTED);
  });

  it('allows writes without an Origin header', async () => {
    const res = await request(app).post('/api/books').send(book);

    expect(res.status).toBe(201);
  });

  it('does not restrict reads by origin', async () => {
    const res = await request(app).get('/api/books').set('Origin', FOREIGN);

    expect(res.status).toBe(200);
  });
});
