import pg from 'pg';
import { loadLocalEnv } from '../env-file.js';
import { migrate } from '../postgres/migrate.js';

// CLI миграций: npm run db:migrate (dev) и node dist/api/server/cli/migrate.js (прод)
loadLocalEnv();

const url = process.env.MIGRATION_DATABASE_URL;
if (!url) {
  console.error('db:migrate: задайте MIGRATION_DATABASE_URL (строка подключения library_owner)');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
try {
  await client.connect();
  const { applied, skipped } = await migrate(client, { dir: 'db/migrations' });
  console.log(`применено: ${applied.join(', ') || 'ничего'}, пропущено: ${skipped}`);
} catch (error) {
  // Текст ошибки без строки подключения
  console.error(`db:migrate: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
