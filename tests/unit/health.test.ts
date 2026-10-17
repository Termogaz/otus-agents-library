import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.js';
import { JsonFileRepository } from '../../src/server/json-file-repository.js';

describe('GET /api/health', () => {
  it('returns status ok', async () => {
    // Хранилище health не трогает: файл не создаётся
    const repo = new JsonFileRepository(join(tmpdir(), 'library-health-unused.json'));
    const res = await request(createApp({ repo })).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
