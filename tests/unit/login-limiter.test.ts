import { describe, expect, it } from 'vitest';
import { LoginLimiter } from '../../src/server/auth/login-limiter.js';

const MINUTE = 60_000;

function makeLimiter(
  options: { maxFailures?: number; maxFailuresPerAddress?: number; maxEntries?: number } = {},
) {
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
    const { limiter } = makeLimiter({ maxFailures: 2, maxEntries: 3 });

    for (const login of ['a', 'b', 'c', 'd']) limiter.recordFailure(login);
    limiter.recordFailure('d');

    // Самая старая незаблокированная запись вытеснена, память ограничена
    limiter.recordFailure('a');
    expect(limiter.isBlocked('a')).toBe(false);
    expect(limiter.isBlocked('d')).toBe(true);
  });

  it('never evicts a blocked entry to make room', () => {
    const { limiter } = makeLimiter({ maxFailures: 2, maxEntries: 2 });
    limiter.recordFailure('target');
    limiter.recordFailure('target');

    // Поток неудач на случайные логины не сбрасывает блокировку цели
    for (let i = 0; i < 50; i += 1) limiter.recordFailure(`random-${i}`);

    expect(limiter.isBlocked('target')).toBe(true);
  });

  it('refuses a new attempt when only blocked entries fill the memory', () => {
    const { limiter } = makeLimiter({ maxFailures: 1, maxEntries: 2 });
    expect(limiter.tryBegin('a', '198.51.100.1')).toBe(true);
    expect(limiter.tryBegin('b', '198.51.100.2')).toBe(true);

    // Вытеснить нечего: обе записи заблокированы, новая попытка отклоняется, а не забывает их
    expect(limiter.tryBegin('c', '198.51.100.3')).toBe(false);
    expect(limiter.isBlocked('a', '198.51.100.1')).toBe(true);
    expect(limiter.isBlocked('b', '198.51.100.2')).toBe(true);
  });
});

describe('LoginLimiter reservations', () => {
  const ip = '203.0.113.7';

  it('counts the attempt up front so concurrent attempts stop at the limit', () => {
    const { limiter } = makeLimiter();

    // Все десять попыток начаты до того, как хоть одна проверка пароля закончилась
    const started = Array.from({ length: 10 }, () => limiter.tryBegin('anna', ip));

    expect(started.filter(Boolean)).toHaveLength(5);
    expect(limiter.isBlocked('anna', ip)).toBe(true);
  });

  it('releases the reserved attempt after a success', () => {
    const { limiter } = makeLimiter();
    for (let i = 0; i < 4; i += 1) expect(limiter.tryBegin('anna', ip)).toBe(true);

    expect(limiter.tryBegin('anna', ip)).toBe(true);
    limiter.recordSuccess('anna', ip);

    expect(limiter.isBlocked('anna', ip)).toBe(false);
    expect(limiter.tryBegin('anna', ip)).toBe(true);
  });

  it('releases a reservation that ended without a password check', () => {
    const { limiter } = makeLimiter({ maxFailures: 1 });

    expect(limiter.tryBegin('anna', ip)).toBe(true);
    limiter.release('anna', ip);

    expect(limiter.tryBegin('anna', ip)).toBe(true);
  });

  it('keys failures by login and client address', () => {
    const { limiter } = makeLimiter();
    for (let i = 0; i < 5; i += 1) limiter.tryBegin('anna', ip);

    expect(limiter.tryBegin('anna', ip)).toBe(false);
    // Перебор с одного адреса не запирает тот же логин для другого адреса
    expect(limiter.isBlocked('anna', '198.51.100.20')).toBe(false);
    expect(limiter.tryBegin('anna', '198.51.100.20')).toBe(true);
  });

  it('limits failures per client address across logins', () => {
    const { limiter } = makeLimiter({ maxFailuresPerAddress: 3 });

    for (const login of ['a1', 'a2', 'a3']) expect(limiter.tryBegin(login, ip)).toBe(true);

    // Перебор случайных логинов с одного адреса упирается в общий бюджет адреса
    expect(limiter.tryBegin('a4', ip)).toBe(false);
    expect(limiter.tryBegin('a4', '198.51.100.20')).toBe(true);
  });
});
