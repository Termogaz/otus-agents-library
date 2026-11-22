import { describe, expect, it } from 'vitest';
import { loadApiSpec, loadErrorCodes } from '../support/api-spec.js';

const routes = loadApiSpec();
const codes = loadErrorCodes();

function find(method: string, path: string) {
  return routes.find((route) => route.method === method && route.path === path);
}

describe('api spec', () => {
  it('parses every route of the spec table', () => {
    // В спеке 19 маршрутов: книги и читатели по 5, выдачи 3, вход 4, health и AI по одному
    expect(routes.length).toBeGreaterThanOrEqual(19);
    expect(find('GET', '/api/health')).toBeDefined();
    expect(find('POST', '/api/ai/book-draft')).toBeDefined();
    expect(find('POST', '/api/loans/:id/return')).toMatchObject({ success: 200 });
  });

  it('lists only known roles and methods', () => {
    for (const route of routes) {
      expect(['GET', 'POST', 'PATCH', 'DELETE']).toContain(route.method);
      expect(route.roles.length).toBeGreaterThan(0);
      for (const role of route.roles) expect(['anon', 'reader', 'librarian']).toContain(role);
      expect(route.success).toBeGreaterThanOrEqual(200);
      expect(route.success).toBeLessThan(300);
    }
  });

  it('allows writes only to librarian except login', () => {
    const exempt = new Set(['/api/auth/login', '/api/auth/logout']);
    const writes = routes.filter((route) => route.method !== 'GET' && !exempt.has(route.path));
    expect(writes.length).toBeGreaterThan(0);
    for (const route of writes) {
      expect(route.roles, `${route.method} ${route.path}`).toEqual(['librarian']);
    }
  });

  it('defines every error code used in routes', () => {
    const byCode = new Map(codes.map((entry) => [entry.code, entry.status]));
    expect(byCode.size).toBe(codes.length);
    for (const route of routes) {
      for (const error of route.errors) {
        expect(byCode.get(error.code), `${route.method} ${route.path}: ${error.code}`).toBe(
          error.status,
        );
      }
    }
  });

  it('keeps login anonymous only', () => {
    expect(find('POST', '/api/auth/login')?.roles).toEqual(['anon']);
    for (const route of routes) {
      if (route.path === '/api/health' || route.path === '/api/auth/login') continue;
      expect(route.roles, `${route.method} ${route.path}`).not.toContain('anon');
    }
  });
});
