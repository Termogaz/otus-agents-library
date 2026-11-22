import type pg from 'pg';
import { JsonFileRepository } from '../json-file-repository.js';
import { SYSTEM_LIBRARIAN } from '../storage.js';
import { withRequestContext } from './postgres-storage.js';

export type TableReport = { inserted: number; skipped: number };
export type ImportReport = { books: TableReport; readers: TableReport; loans: TableReport };

// Переносит файл MVP (data/library.json) в Postgres с теми же id (D-11). Чтение и проверка
// формата — существующим JsonFileRepository, своей схемы нет; сам файл только читается.
// Всё идёт одной транзакцией от имени системного библиотекаря: права и политики RLS те же,
// что у API. Порядок books, readers, loans — под внешние ключи. Уже существующие строки
// (по id) не перезаписываются, а считаются пропущенными, поэтому повторный запуск безопасен.
export async function importJsonFile(file: string, pool: pg.Pool): Promise<ImportReport> {
  const source = new JsonFileRepository(file);
  const [books, readers, loans] = await Promise.all([
    source.listBooks(),
    source.listReaders(),
    source.listLoans(),
  ]);

  return withRequestContext(pool, SYSTEM_LIBRARIAN, async (client) => {
    const report: ImportReport = {
      books: { inserted: 0, skipped: 0 },
      readers: { inserted: 0, skipped: 0 },
      loans: { inserted: 0, skipped: 0 },
    };
    const count = (table: keyof ImportReport, rowCount: number | null) => {
      if (rowCount === 1) report[table].inserted += 1;
      else report[table].skipped += 1;
    };

    for (const b of books) {
      const res = await client.query(
        `insert into books (id, title, author, isbn, copies) values ($1, $2, $3, $4, $5)
         on conflict (id) do nothing`,
        [b.id, b.title, b.author, b.isbn, b.copies],
      );
      count('books', res.rowCount);
    }
    for (const r of readers) {
      const res = await client.query(
        `insert into readers (id, name, contact) values ($1, $2, $3)
         on conflict (id) do nothing`,
        [r.id, r.name, r.contact],
      );
      count('readers', res.rowCount);
    }
    for (const l of loans) {
      const res = await client.query(
        `insert into loans (id, book_id, reader_id, issued_at, due_at, returned_at)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (id) do nothing`,
        [l.id, l.bookId, l.readerId, l.issuedAt, l.dueAt, l.returnedAt],
      );
      count('loans', res.rowCount);
    }
    return report;
  });
}
