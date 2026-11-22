import { afterEach, describe, expect, it, vi } from 'vitest';
import { leaveSession, logout } from '../../src/client-v2/api/live-client.js';

function answer(status: number, body: unknown = null): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('logout on the live client', () => {
  it('treats 401 UNAUTHENTICATED as already logged out', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer(401, { code: 'UNAUTHENTICATED' })));

    await expect(logout()).resolves.toBeUndefined();
  });

  it('still rejects other logout failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer(503, { code: 'DB_UNAVAILABLE' })));

    await expect(logout()).rejects.toMatchObject({ code: 'DB_UNAVAILABLE' });
  });
});

describe('leaveSession', () => {
  it('goes to the login page after a successful logout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer(204)));
    const navigate = vi.fn();

    await leaveSession(navigate);

    expect(navigate).toHaveBeenCalledWith('/login/');
  });

  it('goes to the login page with an expired session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer(401, { code: 'UNAUTHENTICATED' })));
    const navigate = vi.fn();

    await leaveSession(navigate);

    expect(navigate).toHaveBeenCalledWith('/login/');
  });

  it('goes to the login page without rejecting when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const navigate = vi.fn();

    await expect(leaveSession(navigate)).resolves.toBeUndefined();
    expect(navigate).toHaveBeenCalledWith('/login/');
  });
});
