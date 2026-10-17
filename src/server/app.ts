import { randomUUID } from 'node:crypto';
import express, { type ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { availableCopies, checkoutBook, isOverdue, returnBook } from '../domain/index.js';
import type { LibraryRepository } from './repository.js';

export type AppDeps = {
  repo: LibraryRepository;
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

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiError(400, 'VALIDATION_ERROR', z.flattenError(result.error).fieldErrors);
  }
  return result.data;
}

export function createApp({ repo, now = () => new Date(), newId = randomUUID }: AppDeps) {
  const app = express();
  app.use(express.json());

  // Выдача и возврат читают выдачи, проверяют правило и сохраняют. Без очереди два
  // одновременных запроса прочитали бы одно и то же и выдали последний экземпляр дважды
  let tail: Promise<unknown> = Promise.resolve();
  function serial<T>(task: () => Promise<T>): Promise<T> {
    const result = tail.then(task);
    tail = result.catch(() => undefined);
    return result;
  }

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/books', async (_req, res) => {
    const [books, loans] = await Promise.all([repo.listBooks(), repo.listLoans()]);
    res.json(books.map((book) => ({ ...book, available: availableCopies(book, loans) })));
  });

  app.post('/api/books', async (req, res) => {
    const book = { id: newId(), ...parse(bookInput, req.body) };
    await repo.saveBook(book);
    res.status(201).json(book);
  });

  app.get('/api/readers', async (_req, res) => {
    res.json(await repo.listReaders());
  });

  app.post('/api/readers', async (req, res) => {
    const reader = { id: newId(), ...parse(readerInput, req.body) };
    await repo.saveReader(reader);
    res.status(201).json(reader);
  });

  app.get('/api/loans', async (req, res) => {
    const loans = await repo.listLoans(parse(loanQuery, req.query));
    const at = now();
    res.json(loans.map((loan) => ({ ...loan, overdue: isOverdue(loan, at) })));
  });

  app.post('/api/loans', async (req, res) => {
    const { bookId, readerId } = parse(loanInput, req.body);
    const loan = await serial(async () => {
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
    const loan = await serial(async () => {
      const existing = await repo.getLoan(req.params.id);
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
    res.status(500).json({ code: 'INTERNAL_ERROR' });
  };
  app.use(handleError);

  return app;
}
