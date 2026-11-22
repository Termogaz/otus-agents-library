import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Тест держит пункт 1 ДЗ-5 (схема данных) в согласии с миграциями: всё, что создают
// db/migrations/*.sql, обязано быть описано в разделе «Схема данных» docs/architecture.md.
const root = path.resolve(import.meta.dirname, '../..');

function migrationsText(): string {
  const dir = path.join(root, 'db/migrations');
  return readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => readFileSync(path.join(dir, name), 'utf8'))
    .join('\n');
}

function schemaSection(): string {
  const doc = readFileSync(path.join(root, 'docs/architecture.md'), 'utf8').replace(/\r\n/g, '\n');
  const start = doc.indexOf('## Схема данных');
  if (start === -1) throw new Error('В docs/architecture.md нет раздела «Схема данных»');
  const rest = doc.slice(start + 1);
  const next = rest.search(/\n## /);
  return next === -1 ? rest : rest.slice(0, next);
}

function names(sql: string, pattern: RegExp): string[] {
  return [...sql.matchAll(pattern)].map((match) => match[1] as string);
}

describe('schema documentation', () => {
  const sql = migrationsText();
  const section = schemaSection();

  it('documents every table created by migrations', () => {
    const tables = names(sql, /create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)/gi);
    expect(tables.length).toBeGreaterThan(0);
    for (const table of tables) expect(section, `таблица ${table}`).toContain(table);
  });

  it('documents every function created by migrations', () => {
    const functions = names(sql, /create\s+(?:or\s+replace\s+)?function\s+([a-z_][a-z0-9_]*)/gi);
    expect(functions.length).toBeGreaterThan(0);
    for (const fn of functions) expect(section, `функция ${fn}`).toContain(fn);
  });
});
