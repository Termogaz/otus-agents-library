import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/server/app.js';
import type { LibraryRepository } from '../../src/server/repository.js';

// Ошибки express.json() возникают до маршрута, хранилище не нужно
function makeApp() {
  return createApp({ repo: {} as LibraryRepository });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('request body errors', () => {
  it('answers 413 PAYLOAD_TOO_LARGE to a body over the limit without logging a server error', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const body = JSON.stringify({ title: 'x'.repeat(200 * 1024) });

    const res = await request(makeApp())
      .post('/api/books')
      .set('Content-Type', 'application/json')
      .send(body);

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ code: 'PAYLOAD_TOO_LARGE' });
    expect(logged).not.toHaveBeenCalled();
  });

  it('answers 415 UNSUPPORTED_MEDIA_TYPE to an unsupported charset', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await request(makeApp())
      .post('/api/books')
      .set('Content-Type', 'application/json; charset=koi8-r')
      .send('{}');

    expect(res.status).toBe(415);
    expect(res.body).toEqual({ code: 'UNSUPPORTED_MEDIA_TYPE' });
    expect(logged).not.toHaveBeenCalled();
  });

  it('answers 415 UNSUPPORTED_MEDIA_TYPE to an unsupported content encoding', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await request(makeApp())
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .set('Content-Encoding', 'compress')
      .send('{}');

    expect(res.status).toBe(415);
    expect(res.body).toEqual({ code: 'UNSUPPORTED_MEDIA_TYPE' });
    expect(logged).not.toHaveBeenCalled();
  });

  it('keeps 400 INVALID_JSON for a malformed body', async () => {
    const res = await request(makeApp())
      .post('/api/books')
      .set('Content-Type', 'application/json')
      .send('{"title":');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ code: 'INVALID_JSON' });
  });
});
