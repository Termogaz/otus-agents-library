import { randomUUID } from 'node:crypto';
import express, { type ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { availableCopies, checkoutBook, isOverdue, returnBook } from '../domain/index.js';
import { StorageError, type LibraryRepository } from './repository.js';
import { SerialStorage, SYSTEM_LIBRARIAN, type RequestContext, type Storage } from './storage.js';

// Ровно одно из двух: repo (режим JSON, запросы по очереди) или storage (транзакция на запрос)
export type AppDeps = (
  { repo: LibraryRepository; storage?: undefined } | { storage: Storage; repo?: undefined }
) & {
  // Часы и генератор id передаются снаружи, чтобы тесты были детерминированными
  now?: () => Date;
  newId?: () => string;
};

// Ожидаемый отказ API: HTTP-статус и код для клиента
class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(code);
  }
}

const text = z.string().trim().min(1);

const bookInput = z.object({
  title: text,
  author: text,
  isbn: text,
  copies: z.number().int().min(1),
});
const readerInput = z.object({ name: text, contact: text });
const loanInput = z.object({ bookId: text, readerId: text });
const loanQuery = z.object({ bookId: text.optional(), readerId: text.optional() });
const idParams = z.object({ id: text });

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiError(400, 'VALIDATION_ERROR', z.flattenError(result.error).fieldErrors);
  }
  return result.data;
}

// Контекст запроса. Входа пока нет (появится вместе с авторизацией), поэтому все запросы
// идут от имени библиотекаря
function contextOf(_res: express.Response): RequestContext {
  return SYSTEM_LIBRARIAN;
}

export function createApp({
  repo,
  storage: injected,
  now = () => new Date(),
  newId = randomUUID,
}: AppDeps) {
  const app = express();
  app.use(express.json());

  // Каждый маршрут работает внутри storage.run: в режиме JSON это общая очередь (выдача и
  // возврат читают, проверяют и сохраняют, без очереди последний экземпляр выдался бы дважды),
  // в режиме Postgres — транзакция на запрос
  const storage: Storage = injected ?? new SerialStorage(repo);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/books', async (_req, res) => {
    const books = await storage.run(contextOf(res), async (repo) => {
      const [books, loans] = await Promise.all([repo.listBooks(), repo.listLoans()]);
      return books.map((book) => ({ ...book, available: availableCopies(book, loans) }));
    });
    res.json(books);
  });

  app.post('/api/books', async (req, res) => {
    const book = { id: newId(), ...parse(bookInput, req.body) };
    await storage.run(contextOf(res), (repo) => repo.saveBook(book));
    res.status(201).json(book);
  });

  app.get('/api/readers', async (_req, res) => {
    res.json(await storage.run(contextOf(res), (repo) => repo.listReaders()));
  });

  app.post('/api/readers', async (req, res) => {
    const reader = { id: newId(), ...parse(readerInput, req.body) };
    await storage.run(contextOf(res), (repo) => repo.saveReader(reader));
    res.status(201).json(reader);
  });

  app.get('/api/loans', async (req, res) => {
    const filter = parse(loanQuery, req.query);
    const loans = await storage.run(contextOf(res), (repo) => repo.listLoans(filter));
    const at = now();
    res.json(loans.map((loan) => ({ ...loan, overdue: isOverdue(loan, at) })));
  });

  app.post('/api/loans', async (req, res) => {
    const { bookId, readerId } = parse(loanInput, req.body);
    const loan = await storage.run(contextOf(res), async (repo) => {
      const [book, reader] = await Promise.all([repo.getBook(bookId), repo.getReader(readerId)]);
      if (!book) throw new ApiError(404, 'BOOK_NOT_FOUND');
      if (!reader) throw new ApiError(404, 'READER_NOT_FOUND');

      // Все выдачи, а не выдачи книги + выдачи читателя: в объединении общая выдача
      // посчиталась бы дважды
      const loans = await repo.listLoans();
      const result = checkoutBook({ loanId: newId(), book, reader, loans, now: now() });
      if (!result.ok) throw new ApiError(409, result.code);

      await repo.saveLoan(result.loan);
      return result.loan;
    });
    res.status(201).json(loan);
  });

  app.post('/api/loans/:id/return', async (req, res) => {
    const { id } = parse(idParams, req.params);
    const loan = await storage.run(contextOf(res), async (repo) => {
      const existing = await repo.getLoan(id);
      if (!existing) throw new ApiError(404, 'LOAN_NOT_FOUND');

      const result = returnBook({ loan: existing, now: now() });
      if (!result.ok) throw new ApiError(409, result.code);

      await repo.saveLoan(result.loan);
      return result.loan;
    });
    res.json(loan);
  });

  const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof ApiError) {
      res.status(error.status).json({ code: error.code, details: error.details });
      return;
    }
    // Тело запроса — не JSON: ошибку бросает express.json()
    if (typeof error === 'object' && error !== null && 'type' in error) {
      if (error.type === 'entity.parse.failed') {
        res.status(400).json({ code: 'INVALID_JSON' });
        return;
      }
    }
    console.error(error);
    // Сбой хранилища — вина сервера, поэтому 500, но с кодом: по нему видно, что чинить файл данных
    const code = error instanceof StorageError ? error.code : 'INTERNAL_ERROR';
    res.status(500).json({ code });
  };
  app.use(handleError);

  return app;
}
