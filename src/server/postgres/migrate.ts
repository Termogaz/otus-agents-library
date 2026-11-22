import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type pg from 'pg';

// Ключ advisory lock: два раннера (например, два контейнера) не мигрируют одновременно
const LOCK_KEY = 8_080_001;

// Имя таблицы подставляется в SQL текстом, поэтому проверяется строго
const TABLE_NAME = /^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)?$/;
const FILE_NAME = /^(\d{3})-[a-z0-9-]+\.sql$/;

export interface MigrateOptions {
  dir: string;
  table?: string;
}

export interface MigrateResult {
  applied: string[];
  skipped: number;
}

// Контрольная сумма считается после замены CRLF на LF: на Windows и в Linux файл даёт одну сумму
function checksum(text: string): string {
  return createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');
}

// Применяет файлы NNN-*.sql из каталога по порядку номера. Каждый файл — в своей транзакции,
// применённый больше не выполняется, а изменённый после применения отклоняется.
// Блокировка сессионная, поэтому все запросы идут через один клиент.
export async function migrate(
  client: pg.ClientBase,
  options: MigrateOptions,
): Promise<MigrateResult> {
  const table = options.table ?? 'schema_migrations';
  if (!TABLE_NAME.test(table)) throw new Error(`migrate: недопустимое имя таблицы «${table}»`);

  const files = (await readdir(options.dir)).filter((name) => FILE_NAME.test(name)).sort();
  const result: MigrateResult = { applied: [], skipped: 0 };

  await client.query('select pg_advisory_lock($1)', [LOCK_KEY]);
  try {
    await client.query(
      `create table if not exists ${table} (
        version integer primary key,
        name text not null,
        checksum text not null,
        applied_at timestamptz not null default now()
      )`,
    );
    const done = await client.query<{ version: number; checksum: string }>(
      `select version, checksum from ${table}`,
    );
    const known = new Map(done.rows.map((row) => [row.version, row.checksum]));

    for (const name of files) {
      const version = Number(FILE_NAME.exec(name)?.[1]);
      const text = (await readFile(path.join(options.dir, name), 'utf8')).replace(/\r\n/g, '\n');
      const sum = checksum(text);
      const recorded = known.get(version);

      if (recorded !== undefined) {
        if (recorded !== sum) {
          throw new Error(`migration ${String(version).padStart(3, '0')} checksum mismatch`);
        }
        result.skipped += 1;
        continue;
      }

      await client.query('begin');
      try {
        await client.query(text);
        await client.query(`insert into ${table} (version, name, checksum) values ($1, $2, $3)`, [
          version,
          name,
          sum,
        ]);
        await client.query('commit');
      } catch (error) {
        await client.query('rollback').catch(() => {});
        throw error;
      }
      result.applied.push(name);
    }
  } finally {
    await client.query('select pg_advisory_unlock($1)', [LOCK_KEY]);
  }
  return result;
}
