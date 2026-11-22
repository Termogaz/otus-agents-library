import { parseArgs } from 'node:util';
import pg from 'pg';
import { ApiError } from '../api-error.js';
import { PgAuthStore, userInput } from '../auth/auth.js';
import { loadLocalEnv } from '../env-file.js';
import { SYSTEM_LIBRARIAN } from '../storage.js';

// Заводит учётку без API: первого библиотекаря, пока войти некому.
// Запуск: npx tsx src/server/cli/create-user.ts --login admin --role librarian
// (в образе: node dist/api/server/cli/create-user.js). Пароль читается из stdin целиком,
// поэтому в аргументах и истории оболочки его нет.
loadLocalEnv();

function fail(message: string): never {
  console.error(`create-user: ${message}`);
  process.exit(1);
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

const { values } = parseArgs({
  options: {
    login: { type: 'string' },
    role: { type: 'string' },
    'reader-id': { type: 'string' },
  },
  strict: true,
});

if (process.stdin.isTTY) fail('передайте пароль через stdin, например: echo -n ... | команда');
const url = process.env.DATABASE_URL;
if (!url) fail('задайте DATABASE_URL (строка подключения library_api)');

// Только завершающий перевод строки: пробелы внутри пароля сохраняются
const password = (await readStdin()).replace(/\r?\n$/, '');
const parsed = userInput.safeParse({
  login: values.login,
  password,
  role: values.role,
  readerId: values['reader-id'],
});
if (!parsed.success) {
  // Только имена полей: введённые значения, и пароль в первую очередь, не выводятся
  const fields = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.') || 'input'))];
  fail(`некорректные поля: ${fields.join(', ')}`);
}

// Роль library_api и контекст библиотекаря: те же права и политики, что у API
const pool = new pg.Pool({ connectionString: url });
try {
  const user = await new PgAuthStore(pool).createUser(SYSTEM_LIBRARIAN, parsed.data);
  console.log(`учётка создана: ${user.login}, ${user.role}`);
} catch (error) {
  // Текст ошибки без строки подключения и пароля
  const reason =
    error instanceof ApiError ? error.code : error instanceof Error ? error.message : '';
  console.error(`create-user: ${reason || 'не удалось создать учётку'}`);
  process.exitCode = 1;
} finally {
  await pool.end().catch(() => undefined);
}
