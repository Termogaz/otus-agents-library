import path from 'node:path';
import pg from 'pg';
import { loadLocalEnv } from '../../src/server/env-file.js';
import { migrate } from '../../src/server/postgres/migrate.js';
import { assertTestDatabase, requireTestUrls } from './support/db.js';

// Перед тестами применяет миграции к library_test от владельца
export default async function setup(): Promise<void> {
  loadLocalEnv();
  const { apiUrl, ownerUrl } = requireTestUrls();
  assertTestDatabase(apiUrl);
  assertTestDatabase(ownerUrl);

  const client = new pg.Client({ connectionString: ownerUrl });
  try {
    await client.connect();
  } catch {
    throw new Error('test:db: база library_test недоступна, запустите npm run db:up');
  }
  try {
    await migrate(client, { dir: path.resolve(import.meta.dirname, '../../db/migrations') });
  } finally {
    await client.end();
  }
}
