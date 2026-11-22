import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.js';
import type { AuthStore, LoginUser } from '../../src/server/auth/auth.js';
import { hashPassword } from '../../src/server/auth/password.js';
import type { LibraryRepository } from '../../src/server/repository.js';

const PASSWORD = 'correct horse battery staple';
const WRONG = 'a completely wrong password';
let passwordHash: string;

beforeAll(async () => {
  // Хеширование намеренно медленное: считаем один раз на весь файл
  passwordHash = await hashPassword(PASSWORD);
});

// Учётки в памяти: считает, сколько попыток дошло до проверки пароля
function makeStore() {
  const calls = { findUser: 0 };
  const store: AuthStore = {
    findUserForLogin: async (login) => {
      calls.findUser += 1;
      const user: LoginUser = {
        userId: '00000000-0000-4000-8000-000000000001',
        passwordHash,
        role: 'librarian',
        readerId: null,
      };
      return login === 'anna.lib' ? user : undefined;
    },
    createSession: async () => undefined,
    deleteSession: async () => undefined,
    resolveSession: async () => undefined,
    createUser: () => Promise.reject(new Error('не используется')),
  };
  return { store, calls };
}

function makeApp(store: AuthStore) {
  // Хранилище данных библиотекарю при входе не нужно: профиль без карточки читателя
  const app = createApp({ repo: {} as LibraryRepository, auth: { store } });
  app.set('trust proxy', 1);
  return app;
}

function attempt(app: ReturnType<typeof makeApp>, password: string, ip = '203.0.113.7') {
  return request(app)
    .post('/api/auth/login')
    .set('X-Forwarded-For', ip)
    .send({ login: 'anna.lib', password });
}

describe('POST /api/auth/login limiter', () => {
  it('lets at most five of ten concurrent wrong-password attempts reach the password check', async () => {
    const { store, calls } = makeStore();
    const app = makeApp(store);

    const results = await Promise.all(Array.from({ length: 10 }, () => attempt(app, WRONG)));

    const statuses = results.map((res) => res.status).sort();
    expect(calls.findUser).toBeLessThanOrEqual(5);
    expect(statuses.filter((status) => status === 401)).toHaveLength(5);
    expect(statuses.filter((status) => status === 429)).toHaveLength(5);
    for (const res of results.filter((r) => r.status === 429)) {
      expect(res.body.code).toBe('TOO_MANY_ATTEMPTS');
    }
  });

  it('does not lock out the login for a client on another address', async () => {
    const { store } = makeStore();
    const app = makeApp(store);
    for (let i = 0; i < 5; i += 1) {
      expect((await attempt(app, WRONG, '198.51.100.66')).status).toBe(401);
    }
    expect((await attempt(app, PASSWORD, '198.51.100.66')).status).toBe(429);

    // Настоящий библиотекарь с другого адреса входит, хотя атакующий запер свою пару
    const owner = await attempt(app, PASSWORD, '203.0.113.7');

    expect(owner.status).toBe(200);
    expect(owner.body.login).toBe('anna.lib');
  });
});
