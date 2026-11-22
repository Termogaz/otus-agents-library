import { access } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import pg from 'pg';
import { loadLocalEnv } from '../env-file.js';
import { importJsonFile, type TableReport } from '../postgres/import-json.js';

// Перенос данных MVP в Postgres: npm run db:import [-- --file путь]
// (в образе: node dist/api/server/cli/import.js). Файл по умолчанию — LIBRARY_DATA_FILE
// или data/library.json; сам файл не меняется. Повторный запуск безопасен.
loadLocalEnv();

function fail(message: string): never {
  console.error(`db:import: ${message}`);
  process.exit(1);
}

const { values } = parseArgs({ options: { file: { type: 'string' } }, strict: true });
const file = values.file ?? process.env.LIBRARY_DATA_FILE ?? 'data/library.json';
const url = process.env.DATABASE_URL;
if (!url) fail('задайте DATABASE_URL (строка подключения library_api)');

// Без файла JsonFileRepository прочитал бы пустое хранилище и «успешно» перенёс ноль строк
try {
  await access(file);
} catch {
  fail(`файл не найден: ${file}`);
}

const line = (title: string, t: TableReport) =>
  console.log(`${title}: перенесено ${t.inserted} / пропущено ${t.skipped}`);

const pool = new pg.Pool({ connectionString: url });
try {
  const report = await importJsonFile(file, pool);
  line('книги', report.books);
  line('читатели', report.readers);
  line('выдачи', report.loans);
} catch (error) {
  // Текст ошибки без строки подключения; транзакция откатилась целиком
  console.error(
    `db:import: ${error instanceof Error ? error.message : 'не удалось перенести данные'}`,
  );
  process.exitCode = 1;
} finally {
  await pool.end().catch(() => undefined);
}
