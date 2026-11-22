import pg from 'pg';

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

// Очищает данные таблиц; cascade заодно чистит будущие users, sessions, ai_usage
export async function resetData(owner: pg.Pool): Promise<void> {
  const { rows } = await owner.query<{ db: string }>('select current_database() as db');
  const db = rows[0]?.db ?? '';
  if (!db.endsWith('_test')) {
    throw new Error(`test:db: текущая база «${db}» не оканчивается на _test, очистка запрещена`);
  }
  await owner.query('truncate table books, readers, loans cascade');
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
