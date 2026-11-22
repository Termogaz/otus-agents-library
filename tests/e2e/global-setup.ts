import path from 'node:path';
import pg from 'pg';
import { loadLocalEnv } from '../../src/server/env-file.js';
import { migrate } from '../../src/server/postgres/migrate.js';
import {
  apiPool,
  asLibrarian,
  assertTestDatabase,
  createAccount,
  ownerPool,
  requireTestUrls,
  resetData,
} from '../db/support/db.js';
import { accounts } from '../fixtures/accounts.js';

// Перед прогоном e2e: миграции, очистка и учётки в library_test.
// Без суффикса _test в имени базы — громкая ошибка до любого изменения.
export default async function globalSetup(): Promise<void> {
  loadLocalEnv();
  const { apiUrl, ownerUrl } = requireTestUrls();
  assertTestDatabase(apiUrl);
  assertTestDatabase(ownerUrl);

  const client = new pg.Client({ connectionString: ownerUrl });
  try {
    await client.connect();
  } catch (error) {
    throw new Error('e2e: база library_test недоступна, запустите npm run db:up', {
      cause: error,
    });
  }
  try {
    await migrate(client, { dir: path.resolve(import.meta.dirname, '../../db/migrations') });
  } finally {
    await client.end();
  }

  const owner = ownerPool();
  const api = apiPool();
  try {
    await resetData(owner);

    const { reader } = accounts;
    await asLibrarian(api, (db) =>
      db.query('insert into readers (id, name, contact) values ($1, $2, $3)', [
        reader.readerId,
        reader.readerName,
        'e2e@example.com',
      ]),
    );
    await createAccount(api, { ...accounts.librarian, role: 'librarian' });
    await createAccount(api, {
      login: reader.login,
      password: reader.password,
      role: 'reader',
      readerId: reader.readerId,
    });
  } finally {
    await api.end();
    await owner.end();
  }
}
