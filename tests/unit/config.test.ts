import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/server/config.js';

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
});
