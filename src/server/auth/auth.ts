import { createHash, randomBytes } from 'node:crypto';
import express, { type RequestHandler } from 'express';
import type pg from 'pg';
import { z } from 'zod';
import { ApiError } from '../api-error.js';
import type { RequestContext, Storage } from '../storage.js';
import { LoginLimiter } from './login-limiter.js';
import { DUMMY_HASH, verifyPassword } from './password.js';

export const SESSION_COOKIE = 'library_session';
const SESSION_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export type UserRole = 'librarian' | 'reader';

// Пользователь для проверки пароля; хеш наружу из этого модуля не уходит
export type LoginUser = {
  userId: string;
  passwordHash: string;
  role: UserRole;
  readerId: string | null;
};

// Пользователь действующей сессии
export type SessionUser = {
  userId: string;
  login: string;
  role: UserRole;
  readerId: string | null;
};

// Доступ к учёткам и сессиям. Сессии и пароли в БД закрыты от роли приложения,
// поэтому реализация ходит только через функции auth_* (SECURITY DEFINER).
export interface AuthStore {
  findUserForLogin(login: string): Promise<LoginUser | undefined>;
  createSession(tokenHash: string, userId: string, expiresAt: Date): Promise<void>;
  deleteSession(tokenHash: string): Promise<void>;
  resolveSession(tokenHash: string): Promise<SessionUser | undefined>;
}

export type AuthDeps = {
  store: AuthStore;
  // Лимит неудачных входов; по умолчанию новый, со стандартными 5 попытками за 15 минут
  limiter?: LoginLimiter;
  now?: () => Date;
};

type LoginRow = {
  user_id: string;
  password_hash: string;
  role: UserRole;
  reader_id: string | null;
};
type SessionRow = { user_id: string; login: string; role: UserRole; reader_id: string | null };

export class PgAuthStore implements AuthStore {
  constructor(private readonly pool: pg.Pool) {}

  async findUserForLogin(login: string): Promise<LoginUser | undefined> {
    const { rows } = await this.pool.query<LoginRow>(
      'select user_id, password_hash, role, reader_id from auth_find_user_for_login($1)',
      [login],
    );
    const row = rows[0];
    if (!row) return undefined;
    return {
      userId: row.user_id,
      passwordHash: row.password_hash,
      role: row.role,
      readerId: row.reader_id,
    };
  }

  async createSession(tokenHash: string, userId: string, expiresAt: Date): Promise<void> {
    await this.pool.query('select auth_create_session($1, $2, $3)', [tokenHash, userId, expiresAt]);
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await this.pool.query('select auth_delete_session($1)', [tokenHash]);
  }

  async resolveSession(tokenHash: string): Promise<SessionUser | undefined> {
    const { rows } = await this.pool.query<SessionRow>(
      'select user_id, login, role, reader_id from auth_resolve_session($1)',
      [tokenHash],
    );
    const row = rows[0];
    if (!row) return undefined;
    return { userId: row.user_id, login: row.login, role: row.role, readerId: row.reader_id };
  }
}

// Логин: после trim и toLowerCase 3-64 символа из [a-z0-9._-]
const loginField = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,64}$/);
const passwordField = z.string().min(12).max(128);

export const loginInput = z.object({ login: loginField, password: passwordField });

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiError(400, 'VALIDATION_ERROR', z.flattenError(result.error).fieldErrors);
  }
  return result.data;
}

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Разбор Cookie вручную: пакет cookie-parser не нужен (D-16)
export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() !== name) continue;
    const value = part.slice(index + 1).trim();
    return value === '' ? undefined : value;
  }
  return undefined;
}

// Ставит в res.locals контекст запроса и логин. Нет cookie или сессии — 401 до обращения к данным.
export function authenticate(store: AuthStore): RequestHandler {
  return async (req, res, next) => {
    const token = readCookie(req.headers.cookie, SESSION_COOKIE);
    if (!token) throw new ApiError(401, 'UNAUTHENTICATED');
    const tokenHash = hashToken(token);
    const user = await store.resolveSession(tokenHash);
    if (!user) throw new ApiError(401, 'UNAUTHENTICATED');
    const ctx: RequestContext = { userId: user.userId, role: user.role, readerId: user.readerId };
    res.locals.ctx = ctx;
    res.locals.login = user.login;
    res.locals.tokenHash = tokenHash;
    next();
  };
}

const cookieAttributes = (secure: boolean) =>
  ({ httpOnly: true, sameSite: 'lax', secure, path: '/' }) as const;

// Маршруты входа. Порядок важен: вход открыт для всех, всё после router.use(authenticate)
// требует сессии. Роутер подключается в app.ts сразу после /api/health: запрос к любому
// маршруту ниже по цепочке сначала проходит через authenticate.
export function createAuthRouter(
  { store, limiter = new LoginLimiter(), now = () => new Date() }: AuthDeps,
  storage: Storage,
) {
  const router = express.Router();

  router.post('/api/auth/login', async (req, res) => {
    const { login, password } = parse(loginInput, req.body);
    // Блокировка проверяется до пароля: перебор не получает ответа о верном пароле
    if (limiter.isBlocked(login)) throw new ApiError(429, 'TOO_MANY_ATTEMPTS');
    const user = await store.findUserForLogin(login);
    // Для неизвестного логина считается тот же scrypt: ответ и время не выдают, что логина нет
    const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) {
      limiter.recordFailure(login);
      throw new ApiError(401, 'INVALID_CREDENTIALS');
    }
    limiter.recordSuccess(login);

    // Новый токен на каждый вход: сессию нельзя навязать заранее (фиксация сессии)
    const token = newSessionToken();
    const maxAge = SESSION_DAYS * DAY_MS;
    await store.createSession(hashToken(token), user.userId, new Date(now().getTime() + maxAge));
    res.cookie(SESSION_COOKIE, token, { ...cookieAttributes(req.secure), maxAge });

    const profile = await profileOf(
      storage,
      { login, role: user.role, readerId: user.readerId },
      {
        userId: user.userId,
        role: user.role,
        readerId: user.readerId,
      },
    );
    res.json(profile);
  });

  router.use(authenticate(store));

  router.post('/api/auth/logout', async (req, res) => {
    await store.deleteSession(res.locals.tokenHash as string);
    res.clearCookie(SESSION_COOKIE, cookieAttributes(req.secure));
    res.status(204).end();
  });

  router.get('/api/auth/me', async (_req, res) => {
    const ctx = res.locals.ctx as RequestContext;
    res.json(
      await profileOf(
        storage,
        { login: res.locals.login as string, role: ctx.role, readerId: ctx.readerId },
        ctx,
      ),
    );
  });

  return router;
}

// Профиль по спеке: для читателя добавляется имя из его карточки
async function profileOf(
  storage: Storage,
  user: { login: string; role: UserRole; readerId: string | null },
  ctx: RequestContext,
) {
  let readerName: string | null = null;
  if (user.readerId) {
    const readerId = user.readerId;
    const reader = await storage.run(ctx, (repo) => repo.getReader(readerId));
    readerName = reader?.name ?? null;
  }
  return { login: user.login, role: user.role, readerId: user.readerId, readerName };
}
