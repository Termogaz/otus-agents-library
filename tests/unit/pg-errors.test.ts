import pg from 'pg';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.js';
import { httpErrorFromDatabase } from '../../src/server/postgres/pg-errors.js';
import type { LibraryRepository } from '../../src/server/repository.js';

function databaseError(code: string, message = 'db message'): pg.DatabaseError {
  const error = new pg.DatabaseError(message, 0, 'error');
  error.code = code;
  return error;
}

function systemError(code: string): Error {
  return Object.assign(new Error(`connect ${code}`), { code });
}

describe('httpErrorFromDatabase', () => {
  it('maps row level security violation to 403 FORBIDDEN', () => {
    expect(httpErrorFromDatabase(databaseError('42501'))).toEqual({
      status: 403,
      code: 'FORBIDDEN',
    });
  });

  it('maps unique and foreign key violations to 409 CONFLICT', () => {
    const expected = { status: 409, code: 'CONFLICT' };
    expect(httpErrorFromDatabase(databaseError('23505'))).toEqual(expected);
    expect(httpErrorFromDatabase(databaseError('23503'))).toEqual(expected);
  });

  it('maps serialization, deadlock and lock timeout to 503 DB_BUSY', () => {
    const expected = { status: 503, code: 'DB_BUSY' };
    expect(httpErrorFromDatabase(databaseError('40001'))).toEqual(expected);
    expect(httpErrorFromDatabase(databaseError('40P01'))).toEqual(expected);
    expect(httpErrorFromDatabase(databaseError('55P03'))).toEqual(expected);
  });

  it('maps statement timeout to 503 DB_BUSY', () => {
    expect(httpErrorFromDatabase(databaseError('57014'))).toEqual({
      status: 503,
      code: 'DB_BUSY',
    });
  });

  it('maps refused connection to 503 DB_UNAVAILABLE', () => {
    const expected = { status: 503, code: 'DB_UNAVAILABLE' };
    expect(httpErrorFromDatabase(systemError('ECONNREFUSED'))).toEqual(expected);
    expect(httpErrorFromDatabase(systemError('ENOTFOUND'))).toEqual(expected);
    expect(httpErrorFromDatabase(systemError('ECONNRESET'))).toEqual(expected);
  });

  it('maps pool connection timeout to 503 DB_UNAVAILABLE', () => {
    const error = new Error('timeout exceeded when trying to connect');
    expect(httpErrorFromDatabase(error)).toEqual({ status: 503, code: 'DB_UNAVAILABLE' });
  });

  it('returns undefined for unknown errors', () => {
    expect(httpErrorFromDatabase(databaseError('XX000'))).toBeUndefined();
    expect(httpErrorFromDatabase(new Error('boom'))).toBeUndefined();
    expect(httpErrorFromDatabase('text')).toBeUndefined();
    expect(httpErrorFromDatabase(undefined)).toBeUndefined();
  });
});

describe('API database errors', () => {
  it('hides database error text from the response body', async () => {
    const errors = [databaseError('42501'), databaseError('XX000', 'secret detail')];
    const repo = {
      listBooks: () => Promise.reject(errors.shift()),
      activeLoanCounts: () => Promise.resolve(new Map<string, number>()),
    } as unknown as LibraryRepository;
    const app = createApp({ repo });

    const forbidden = await request(app).get('/api/books');
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.code).toBe('FORBIDDEN');

    const internal = await request(app).get('/api/books');
    expect(internal.status).toBe(500);
    expect(internal.body.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(internal.body)).not.toContain('secret detail');
  });
});
