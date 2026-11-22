import { randomUUID } from 'node:crypto';
import express, { type ErrorRequestHandler } from 'express';
import { z } from 'zod';
import {
  availableCopiesFromCount,
  checkBookDeletion,
  checkCopiesChange,
  checkReaderDeletion,
  checkoutBook,
  isOverdue,
  returnBook,
} from '../domain/index.js';
import { bookDraftHandler, type AiDeps } from './ai/book-draft.js';
import { ApiError } from './api-error.js';
import { accessGuard, createAuthRouter, type AuthDeps } from './auth/auth.js';
import { corsMiddleware } from './cors.js';
import { originCheck } from './origin-check.js';
import { httpErrorFromDatabase } from './postgres/pg-errors.js';
import { StorageError, type LibraryRepository } from './repository.js';
import { SerialStorage, SYSTEM_LIBRARIAN, type RequestContext, type Storage } from './storage.js';

// Ровно одно из двух: repo (режим JSON, запросы по очереди) или storage (транзакция на запрос)
export type AppDeps = (
  { repo: LibraryRepository; storage?: undefined } | { storage: Storage; repo?: undefined }
) & {
  // Часы и генератор id передаются снаружи, чтобы тесты были детерминированными
  now?: () => Date;
  newId?: () => string;
  // Вход по логину и паролю (режим Postgres). Без него все запросы идут от системного библиотекаря
  auth?: AuthDeps;
  // Разрешённые источники для CORS и проверки Origin на записи; по умолчанию пусто
  cors?: { allowedOrigins: ReadonlySet<string> };
  // Черновик книги от AI (D-14). Без него маршрут отвечает 503 AI_DISABLED
  ai?: AiDeps;
};

const text = z.string().trim().min(1);

const bookInput = z.object({
  title: text,
  author: text,
  isbn: text,
  copies: z.number().int().min(1),
});
const readerInput = z.object({ name: text, contact: text });
// Частичное изменение: хотя бы одно поле; лишние поля схема отбрасывает, id берётся из пути
const atLeastOne = (value: object) => Object.keys(value).length > 0;
const bookPatch = bookInput.partial().refine(atLeastOne, { message: 'нужно хотя бы одно поле' });
const readerPatch = readerInput
  .partial()
  .refine(atLeastOne, { message: 'нужно хотя бы одно поле' });
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

// Контекст запроса. Со входом его кладёт authenticate; без входа все запросы идут от имени
// системного библиотекаря. При включённом входе отсутствие контекста — отказ, а не запасной
// библиотекарь: пропущенная проверка не должна открывать доступ.
function contextResolver(authEnabled: boolean) {
  return (res: express.Response): RequestContext => {
    if (!authEnabled) return SYSTEM_LIBRARIAN;
    const ctx = res.locals.ctx as RequestContext | undefined;
    if (!ctx) throw new ApiError(401, 'UNAUTHENTICATED');
    return ctx;
  };
}

export function createApp({
  repo,
  storage: injected,
  now = () => new Date(),
  newId = randomUUID,
  auth,
  cors,
  ai,
}: AppDeps) {
  const app = express();
  // CORS и проверка Origin — первыми, до express.json и authenticate: preflight не должен
  // получать 401, а запись с чужого сайта не должна доходить до разбора тела
  const allowedOrigins = cors?.allowedOrigins ?? new Set<string>();
  app.use(corsMiddleware(allowedOrigins));
  app.use(originCheck(allowedOrigins));
  app.use(express.json());

  // Каждый маршрут работает внутри storage.run: в режиме JSON это общая очередь (выдача и
  // возврат читают, проверяют и сохраняют, без очереди последний экземпляр выдался бы дважды),
  // в режиме Postgres — транзакция на запрос
  const storage: Storage = injected ?? new SerialStorage(repo);
  const contextOf = contextResolver(Boolean(auth));
  // Сессия (при включённом входе) и роль — на каждом маршруте данных отдельно
  const access = accessGuard(auth?.store);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  if (auth) {
    // Вход открыт всем; остальные маршруты входа проверяют сессию сами
    app.use(createAuthRouter(auth, storage));
  } else {
    // Режим без входа: профиль системного библиотекаря, маршрутов входа и выхода нет
    app.get('/api/auth/me', (_req, res) => {
      res.json({ login: null, role: 'librarian', readerId: null, readerName: null });
    });
  }

  app.get('/api/books', ...access('librarian', 'reader'), async (_req, res) => {
    const books = await storage.run(contextOf(res), async (repo) => {
      const [books, counts] = await Promise.all([repo.listBooks(), repo.activeLoanCounts()]);
      return books.map((book) => ({
        ...book,
        available: availableCopiesFromCount(book.copies, counts.get(book.id) ?? 0),
      }));
    });
    res.json(books);
  });

  app.post('/api/books', ...access('librarian'), async (req, res) => {
    const book = { id: newId(), ...parse(bookInput, req.body) };
    await storage.run(contextOf(res), (repo) => repo.saveBook(book));
    res.status(201).json(book);
  });

  app.get('/api/books/:id', ...access('librarian', 'reader'), async (req, res) => {
    const { id } = parse(idParams, req.params);
    const book = await storage.run(contextOf(res), async (repo) => {
      const found = await repo.getBook(id);
      if (!found) throw new ApiError(404, 'BOOK_NOT_FOUND');
      const counts = await repo.activeLoanCounts();
      return { ...found, available: availableCopiesFromCount(found.copies, counts.get(id) ?? 0) };
    });
    res.json(book);
  });

  app.patch('/api/books/:id', ...access('librarian'), async (req, res) => {
    const { id } = parse(idParams, req.params);
    const patch = parse(bookPatch, req.body);
    const book = await storage.run(contextOf(res), async (repo) => {
      // Книга блокируется первой, как при выдаче: один порядок блокировок у всех запросов
      const existing = await repo.getBook(id, { forUpdate: true });
      if (!existing) throw new ApiError(404, 'BOOK_NOT_FOUND');
      const active = (await repo.activeLoanCounts()).get(id) ?? 0;

      const updated = { ...existing, ...patch };
      const result = checkCopiesChange({ copies: updated.copies, activeLoans: active });
      if (!result.ok) throw new ApiError(409, result.code);

      await repo.saveBook(updated);
      return { ...updated, available: availableCopiesFromCount(updated.copies, active) };
    });
    res.json(book);
  });

  app.delete('/api/books/:id', ...access('librarian'), async (req, res) => {
    const { id } = parse(idParams, req.params);
    await storage.run(contextOf(res), async (repo) => {
      // Книга блокируется первой, как при выдаче
      const existing = await repo.getBook(id, { forUpdate: true });
      if (!existing) throw new ApiError(404, 'BOOK_NOT_FOUND');

      const result = checkBookDeletion(await repo.listLoans({ bookId: id }));
      if (!result.ok) throw new ApiError(409, result.code);

      await repo.deleteBook(id);
    });
    res.status(204).end();
  });

  app.get('/api/readers', ...access('librarian'), async (_req, res) => {
    res.json(await storage.run(contextOf(res), (repo) => repo.listReaders()));
  });

  app.post('/api/readers', ...access('librarian'), async (req, res) => {
    const reader = { id: newId(), ...parse(readerInput, req.body) };
    await storage.run(contextOf(res), (repo) => repo.saveReader(reader));
    res.status(201).json(reader);
  });

  app.get('/api/readers/:id', ...access('librarian'), async (req, res) => {
    const { id } = parse(idParams, req.params);
    const reader = await storage.run(contextOf(res), (repo) => repo.getReader(id));
    if (!reader) throw new ApiError(404, 'READER_NOT_FOUND');
    res.json(reader);
  });

  app.patch('/api/readers/:id', ...access('librarian'), async (req, res) => {
    const { id } = parse(idParams, req.params);
    const patch = parse(readerPatch, req.body);
    const reader = await storage.run(contextOf(res), async (repo) => {
      const existing = await repo.getReader(id, { forUpdate: true });
      if (!existing) throw new ApiError(404, 'READER_NOT_FOUND');

      const updated = { ...existing, ...patch };
      await repo.saveReader(updated);
      return updated;
    });
    res.json(reader);
  });

  app.delete('/api/readers/:id', ...access('librarian'), async (req, res) => {
    const { id } = parse(idParams, req.params);
    await storage.run(contextOf(res), async (repo) => {
      const existing = await repo.getReader(id, { forUpdate: true });
      if (!existing) throw new ApiError(404, 'READER_NOT_FOUND');

      const result = checkReaderDeletion(await repo.listLoans({ readerId: id }));
      if (!result.ok) throw new ApiError(409, result.code);

      await repo.deleteReader(id);
    });
    res.status(204).end();
  });

  app.get('/api/loans', ...access('librarian', 'reader'), async (req, res) => {
    const filter = parse(loanQuery, req.query);
    const loans = await storage.run(contextOf(res), (repo) => repo.listLoans(filter));
    const at = now();
    res.json(loans.map((loan) => ({ ...loan, overdue: isOverdue(loan, at) })));
  });

  app.post('/api/loans', ...access('librarian'), async (req, res) => {
    const { bookId, readerId } = parse(loanInput, req.body);
    const loan = await storage.run(contextOf(res), async (repo) => {
      // Строки блокируются строго по очереди: сначала книга, потом читатель. Один порядок у
      // всех запросов исключает взаимоблокировку; блокировка книги не даёт выдать последний
      // экземпляр дважды, блокировка читателя — обойти лимит двумя выдачами сразу
      const book = await repo.getBook(bookId, { forUpdate: true });
      if (!book) throw new ApiError(404, 'BOOK_NOT_FOUND');
      const reader = await repo.getReader(readerId, { forUpdate: true });
      if (!reader) throw new ApiError(404, 'READER_NOT_FOUND');

      // Нужны выдачи книги и выдачи читателя; общая выдача попадает в оба списка,
      // поэтому объединяем по id, иначе она посчиталась бы дважды
      const [bookLoans, readerLoans] = [
        await repo.listLoans({ bookId }),
        await repo.listLoans({ readerId }),
      ];
      const loans = [...new Map([...bookLoans, ...readerLoans].map((l) => [l.id, l])).values()];
      const result = checkoutBook({ loanId: newId(), book, reader, loans, now: now() });
      if (!result.ok) throw new ApiError(409, result.code);

      await repo.saveLoan(result.loan);
      return result.loan;
    });
    res.status(201).json(loan);
  });

  app.post('/api/loans/:id/return', ...access('librarian'), async (req, res) => {
    const { id } = parse(idParams, req.params);
    const loan = await storage.run(contextOf(res), async (repo) => {
      const existing = await repo.getLoan(id, { forUpdate: true });
      if (!existing) throw new ApiError(404, 'LOAN_NOT_FOUND');

      const result = returnBook({ loan: existing, now: now() });
      if (!result.ok) throw new ApiError(409, result.code);

      await repo.saveLoan(result.loan);
      return result.loan;
    });
    res.json(loan);
  });

  // Черновик книги от AI: не сохраняется, библиотекарь правит форму и сохраняет сам (D-14)
  app.post(
    '/api/ai/book-draft',
    ...access('librarian'),
    ai
      ? bookDraftHandler(ai, contextOf)
      : () => {
          throw new ApiError(503, 'AI_DISABLED');
        },
  );

  // Неизвестный путь под /api — JSON с кодом, а не HTML-страница ошибки Express
  app.use('/api', () => {
    throw new ApiError(404, 'NOT_FOUND');
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
    // Ошибка БД: клиенту только код из спеки, подробности не отдаются
    const database = httpErrorFromDatabase(error);
    if (database) {
      res.status(database.status).json({ code: database.code });
      return;
    }
    // В лог идёт полная ошибка (для БД — SQLSTATE и сообщение), клиенту — только код
    console.error(error);
    // Сбой хранилища — вина сервера, поэтому 500, но с кодом: по нему видно, что чинить файл данных
    const code = error instanceof StorageError ? error.code : 'INTERNAL_ERROR';
    res.status(500).json({ code });
  };
  app.use(handleError);

  return app;
}
