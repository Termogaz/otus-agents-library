import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import type { Book, Loan, Reader } from '../domain/index.js';
import { StorageError, type LibraryRepository, type LoanFilter } from './repository.js';

// Версия формата файла: при изменении структуры — повысить и добавить миграцию
const STORAGE_VERSION = 1;

// Даты в файле — ISO-строки (так их пишет JSON.stringify), при чтении превращаются в Date
const isoDate = z.iso.datetime().transform((s) => new Date(s));

const storeSchema = z.object({
  version: z.literal(STORAGE_VERSION),
  books: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      author: z.string(),
      isbn: z.string(),
      copies: z.number().int().nonnegative(),
    }),
  ),
  readers: z.array(z.object({ id: z.string(), name: z.string(), contact: z.string() })),
  loans: z.array(
    z.object({
      id: z.string(),
      bookId: z.string(),
      readerId: z.string(),
      issuedAt: isoDate,
      dueAt: isoDate,
      returnedAt: isoDate.nullable(),
    }),
  ),
});

type Store = { books: Book[]; readers: Reader[]; loans: Loan[] };

// Хранилище в одном JSON-файле. Файл читается при каждой операции, поэтому несколько
// экземпляров видят изменения друг друга. Операции одного экземпляра идут строго по очереди,
// чтобы параллельные save не затёрли друг друга.
export class JsonFileRepository implements LibraryRepository {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(readonly filePath: string) {}

  listBooks(): Promise<Book[]> {
    return this.read((s) => s.books);
  }
  getBook(id: string): Promise<Book | undefined> {
    return this.read((s) => s.books.find((b) => b.id === id));
  }
  saveBook(book: Book): Promise<void> {
    return this.update((s) => ({ ...s, books: upsert(s.books, book) }));
  }

  listReaders(): Promise<Reader[]> {
    return this.read((s) => s.readers);
  }
  getReader(id: string): Promise<Reader | undefined> {
    return this.read((s) => s.readers.find((r) => r.id === id));
  }
  saveReader(reader: Reader): Promise<void> {
    return this.update((s) => ({ ...s, readers: upsert(s.readers, reader) }));
  }

  listLoans(filter: LoanFilter = {}): Promise<Loan[]> {
    return this.read((s) =>
      s.loans.filter(
        (l) =>
          (filter.bookId === undefined || l.bookId === filter.bookId) &&
          (filter.readerId === undefined || l.readerId === filter.readerId),
      ),
    );
  }
  getLoan(id: string): Promise<Loan | undefined> {
    return this.read((s) => s.loans.find((l) => l.id === id));
  }
  saveLoan(loan: Loan): Promise<void> {
    return this.update((s) => ({ ...s, loans: upsert(s.loans, loan) }));
  }

  private read<T>(pick: (store: Store) => T): Promise<T> {
    return this.enqueue(async () => pick(await this.load()));
  }

  private update(change: (store: Store) => Store): Promise<void> {
    return this.enqueue(async () => this.persist(change(await this.load())));
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(task);
    // Ошибка одной операции не должна ломать очередь для следующих
    this.queue = result.catch(() => undefined);
    return result;
  }

  private async load(): Promise<Store> {
    let text: string;
    try {
      text = await readFile(this.filePath, 'utf8');
    } catch (error) {
      if (isNotFound(error)) return { books: [], readers: [], loans: [] };
      throw error;
    }

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new StorageError('INVALID_STORAGE_FILE', `${this.filePath}: файл не является JSON`);
    }

    const version = (raw as { version?: unknown } | null)?.version;
    if (version !== STORAGE_VERSION) {
      throw new StorageError(
        'UNSUPPORTED_STORAGE_VERSION',
        `${this.filePath}: версия ${String(version)}, ожидается ${STORAGE_VERSION}`,
      );
    }

    const parsed = storeSchema.safeParse(raw);
    if (!parsed.success) {
      throw new StorageError(
        'INVALID_STORAGE_FILE',
        `${this.filePath}: ${z.prettifyError(parsed.error)}`,
      );
    }
    const { books, readers, loans } = parsed.data;
    return { books, readers, loans };
  }

  // Атомарная запись: сначала во временный файл, затем rename поверх старого
  private async persist(store: Store): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${randomUUID()}.tmp`;
    await writeFile(tmp, JSON.stringify({ version: STORAGE_VERSION, ...store }, null, 2));
    await rename(tmp, this.filePath);
  }
}

// Заменяет запись с тем же id на месте или добавляет в конец
function upsert<T extends { id: string }>(items: T[], item: T): T[] {
  return items.some((i) => i.id === item.id)
    ? items.map((i) => (i.id === item.id ? item : i))
    : [...items, item];
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT';
}
