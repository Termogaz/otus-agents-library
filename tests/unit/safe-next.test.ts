import { describe, expect, it } from 'vitest';
import { safeNext } from '../../src/client-v2/api/live-client';

// Параметр next на /login/ пропускает только путь своего сайта (T-08-31)
describe('safeNext', () => {
  it('keeps a path of the same site', () => {
    expect(safeNext('/v2/')).toBe('/v2/');
    expect(safeNext('/prototype/?x=1')).toBe('/prototype/?x=1');
  });

  it('falls back to /v2/ when next is missing', () => {
    expect(safeNext(null)).toBe('/v2/');
  });

  it('rejects addresses of other sites', () => {
    for (const raw of [
      '//evil.example',
      '/\\evil.example',
      'https://evil.example/',
      'javascript:alert(1)',
      'v2/',
      '',
    ]) {
      expect(safeNext(raw), raw).toBe('/v2/');
    }
  });

  it('rejects a path with control characters that the browser would strip', () => {
    expect(safeNext('/\t/evil.example')).toBe('/v2/');
    expect(safeNext('/\n/evil.example')).toBe('/v2/');
  });
});
