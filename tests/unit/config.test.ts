import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/server/config.js';
import { buildApp } from '../../src/server/server.js';

describe('loadConfig', () => {
  it('defaults to json storage on port 3000', () => {
    const config = loadConfig({});

    expect(config.storage).toBe('json');
    expect(config.port).toBe(3000);
    expect(config.dataFile).toBe('data/library.json');
  });

  it('reads port and data file from the environment', () => {
    const config = loadConfig({ PORT: '4100', LIBRARY_DATA_FILE: 'x/library.json' });

    expect(config.port).toBe(4100);
    expect(config.dataFile).toBe('x/library.json');
  });

  it('requires DATABASE_URL for postgres storage', () => {
    expect(() => loadConfig({ STORAGE: 'postgres' })).toThrow(/DATABASE_URL/);

    const config = loadConfig({ STORAGE: 'postgres', DATABASE_URL: 'postgres://u@h/db' });
    expect(config.storage).toBe('postgres');
    expect(config.databaseUrl).toBe('postgres://u@h/db');
  });

  it('refuses json storage in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/STORAGE=postgres/);
    expect(() => loadConfig({ NODE_ENV: 'production', STORAGE: 'json' })).toThrow(
      /STORAGE=postgres/,
    );
  });

  it('allows postgres storage in production', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      STORAGE: 'postgres',
      DATABASE_URL: 'postgres://u@h/db',
    });

    expect(config.storage).toBe('postgres');
  });

  it('rejects unknown storage value', () => {
    expect(() => loadConfig({ STORAGE: 'sqlite' })).toThrow(/STORAGE/);
  });

  it('does not put variable values into the error text', () => {
    const secret = 'postgres://user:hunter2@host/db';
    expect(() => loadConfig({ STORAGE: 'mongo', DATABASE_URL: secret })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('hunter2') }),
    );
  });

  it('parses CORS_ALLOWED_ORIGINS into a set of origins', () => {
    const config = loadConfig({
      CORS_ALLOWED_ORIGINS: ' https://a.example , http://localhost:5173,https://b.example:8443 ',
    });

    expect(config.corsAllowedOrigins).toEqual(
      new Set(['https://a.example', 'http://localhost:5173', 'https://b.example:8443']),
    );
    expect(loadConfig({}).corsAllowedOrigins.size).toBe(0);
    expect(loadConfig({ CORS_ALLOWED_ORIGINS: '' }).corsAllowedOrigins.size).toBe(0);
  });

  it('rejects an allowed origin with a path or a wildcard', () => {
    expect(() => loadConfig({ CORS_ALLOWED_ORIGINS: '*' })).toThrow(/CORS_ALLOWED_ORIGINS/);
    expect(() => loadConfig({ CORS_ALLOWED_ORIGINS: 'https://a.example/x' })).toThrow(
      /CORS_ALLOWED_ORIGINS/,
    );
    expect(() => loadConfig({ CORS_ALLOWED_ORIGINS: 'https://a.example/' })).toThrow(
      /CORS_ALLOWED_ORIGINS/,
    );
    expect(() => loadConfig({ CORS_ALLOWED_ORIGINS: 'https://ok.example,*' })).toThrow(
      /CORS_ALLOWED_ORIGINS/,
    );
  });

  it('defaults TRUST_PROXY to 0 and accepts a hop count', () => {
    expect(loadConfig({}).trustProxy).toBe(0);
    expect(loadConfig({ TRUST_PROXY: '1' }).trustProxy).toBe(1);
    expect(loadConfig({ TRUST_PROXY: '2' }).trustProxy).toBe(2);
    expect(() => loadConfig({ TRUST_PROXY: '-1' })).toThrow(/TRUST_PROXY/);
    expect(() => loadConfig({ TRUST_PROXY: 'yes' })).toThrow(/TRUST_PROXY/);
  });
});

describe('buildApp', () => {
  it('applies TRUST_PROXY and CORS in buildApp', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'library-config-'));
    try {
      const config = loadConfig({
        TRUST_PROXY: '1',
        CORS_ALLOWED_ORIGINS: 'https://ok.example',
        LIBRARY_DATA_FILE: join(dir, 'library.json'),
      });
      const { app, close } = buildApp(config);

      expect(app.get('trust proxy')).toBe(1);
      const res = await request(app).get('/api/health').set('Origin', 'https://ok.example');
      expect(res.headers['access-control-allow-origin']).toBe('https://ok.example');
      await close();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
