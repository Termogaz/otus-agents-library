import { describe, expect, it } from 'vitest';
import { LoginLimiter } from '../../src/server/auth/login-limiter.js';

const MINUTE = 60_000;

function makeLimiter(options: { maxFailures?: number; maxEntries?: number } = {}) {
  let current = new Date('2026-03-01T10:00:00.000Z');
  const limiter = new LoginLimiter({ ...options, now: () => current });
  return {
    limiter,
    advance(ms: number) {
      current = new Date(current.getTime() + ms);
    },
  };
}

describe('LoginLimiter', () => {
  it('allows five failures then blocks the login', () => {
    const { limiter } = makeLimiter();

    for (let i = 0; i < 4; i += 1) limiter.recordFailure('anna');
    expect(limiter.isBlocked('anna')).toBe(false);

    limiter.recordFailure('anna');
    expect(limiter.isBlocked('anna')).toBe(true);
    expect(limiter.isBlocked('boris')).toBe(false);
  });

  it('resets the counter after a success', () => {
    const { limiter } = makeLimiter();
    for (let i = 0; i < 4; i += 1) limiter.recordFailure('anna');

    limiter.recordSuccess('anna');
    limiter.recordFailure('anna');

    expect(limiter.isBlocked('anna')).toBe(false);
  });

  it('forgets failures after the window', () => {
    const { limiter, advance } = makeLimiter();
    for (let i = 0; i < 5; i += 1) limiter.recordFailure('anna');
    expect(limiter.isBlocked('anna')).toBe(true);

    advance(15 * MINUTE + 1);

    expect(limiter.isBlocked('anna')).toBe(false);
  });

  it('counts only failures inside the window', () => {
    const { limiter, advance } = makeLimiter();
    for (let i = 0; i < 4; i += 1) limiter.recordFailure('anna');
    advance(15 * MINUTE + 1);

    limiter.recordFailure('anna');

    expect(limiter.isBlocked('anna')).toBe(false);
  });

  it('treats login case-insensitively', () => {
    const { limiter } = makeLimiter();

    for (let i = 0; i < 5; i += 1) limiter.recordFailure(i % 2 === 0 ? 'Anna' : ' anna ');

    expect(limiter.isBlocked('ANNA')).toBe(true);
  });

  it('caps the number of tracked logins', () => {
    const { limiter } = makeLimiter({ maxFailures: 1, maxEntries: 3 });

    for (const login of ['a', 'b', 'c', 'd']) limiter.recordFailure(login);

    // Самая старая запись вытеснена, память ограничена
    expect(limiter.isBlocked('a')).toBe(false);
    expect(limiter.isBlocked('b')).toBe(true);
    expect(limiter.isBlocked('c')).toBe(true);
    expect(limiter.isBlocked('d')).toBe(true);
  });
});
