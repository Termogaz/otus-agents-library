import type express from 'express';
import pg from 'pg';
import request from 'supertest';
import { hashPassword } from '../../../src/server/auth/password.js';

const HINT =
  'test:db: задайте TEST_DATABASE_URL и TEST_MIGRATION_DATABASE_URL и запустите npm run db:up (README)';

// Строки подключения тестовой БД: без них прогон падает громко, а не пропускает тесты
export function requireTestUrls(): { apiUrl: string; ownerUrl: string } {
  const apiUrl = process.env.TEST_DATABASE_URL;
  const ownerUrl = process.env.TEST_MIGRATION_DATABASE_URL;
  if (!apiUrl || !ownerUrl) throw new Error(HINT);
  return { apiUrl, ownerUrl };
}

// Защита от очистки чужой базы: имя базы обязано оканчиваться на _test
export function assertTestDatabase(url: string): void {
  const name = new URL(url).pathname.slice(1);
  if (!name.endsWith('_test')) {
    throw new Error(`test:db: база «${name}» не оканчивается на _test, очистка запрещена`);
  }
}

function makePool(url: string): pg.Pool {
  const pool = new pg.Pool({ connectionString: url, max: 4 });
  // Без обработчика ошибка на простаивающем соединении роняет процесс
  pool.on('error', () => {});
  return pool;
}

// Пул владельца (library_owner): миграции и очистка данных
export function ownerPool(): pg.Pool {
  const { ownerUrl } = requireTestUrls();
  assertTestDatabase(ownerUrl);
  return makePool(ownerUrl);
}

// Пул роли приложения (library_api): так же ходит сервер
export function apiPool(): pg.Pool {
  const { apiUrl } = requireTestUrls();
  assertTestDatabase(apiUrl);
  return makePool(apiUrl);
}

// Очищает данные всех таблиц, включая учётки и сессии; cascade заодно чистит будущие ai_usage
export async function resetData(owner: pg.Pool): Promise<void> {
  const { rows } = await owner.query<{ db: string }>('select current_database() as db');
  const db = rows[0]?.db ?? '';
  if (!db.endsWith('_test')) {
    throw new Error(`test:db: текущая база «${db}» не оканчивается на _test, очистка запрещена`);
  }
  await owner.query('truncate table books, readers, loans, users, sessions cascade');
}

// Фикстуры идут через роль приложения с ролью библиотекаря: политики RLS действуют и в тестах
export async function asLibrarian<T>(
  api: pg.Pool,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await api.connect();
  try {
    await client.query('begin');
    await client.query(
      "select set_config('app.role', 'librarian', true), set_config('app.user_id', 'test-librarian', true)",
    );
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

// Хеширование намеренно медленное: одинаковые пароли в тестах считаются один раз
const hashCache = new Map<string, Promise<string>>();
function cachedHash(password: string): Promise<string> {
  let hash = hashCache.get(password);
  if (!hash) {
    hash = hashPassword(password);
    hashCache.set(password, hash);
  }
  return hash;
}

export type AccountInput = {
  login: string;
  password: string;
  role: 'librarian' | 'reader';
  readerId?: string;
};

// Учётка-фикстура: идёт через роль приложения с ролью библиотекаря, минуя маршруты. Возвращает id.
export async function createAccount(api: pg.Pool, account: AccountInput): Promise<string> {
  const passwordHash = await cachedHash(account.password);
  return asLibrarian(api, async (client) => {
    const { rows } = await client.query<{ id: string }>(
      'insert into users (login, password_hash, role, reader_id) values ($1, $2, $3, $4) returning id',
      [account.login, passwordHash, account.role, account.readerId ?? null],
    );
    return rows[0]?.id ?? '';
  });
}

// Клиент с выполненным входом: agent хранит cookie сессии между запросами
export async function login(
  app: express.Express,
  loginName: string,
  password: string,
): Promise<ReturnType<typeof request.agent>> {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ login: loginName, password });
  if (res.status !== 200) throw new Error(`вход ${loginName} не удался: ${res.status}`);
  return agent;
}
