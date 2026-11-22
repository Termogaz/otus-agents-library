import { ApiError, errorMessage } from '../../client/api';

// Вход и сессия: клиент живого API (D-12). Cookie сессии httpOnly, браузер шлёт её сам.
export type Me = {
  login: string | null;
  role: 'librarian' | 'reader';
  readerId: string | null;
  readerName: string | null;
};

// Куда вести после входа, если next не задан или небезопасен
export const DEFAULT_NEXT = '/v2/';

// Разбор ответа как в src/client/api.ts: нечитаемое тело — INTERNAL_ERROR.
// Сетевой сбой (fetch отклонён) пробрасывается как есть.
async function call(method: 'GET' | 'POST', path: string, body?: unknown): Promise<Response> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const data: unknown = await res.json().catch(() => null);
    const code = (data as { code?: unknown } | null)?.code;
    throw new ApiError(typeof code === 'string' ? code : 'INTERNAL_ERROR');
  }
  return res;
}

export async function login(loginName: string, password: string): Promise<Me> {
  const res = await call('POST', '/api/auth/login', { login: loginName, password });
  return (await res.json()) as Me;
}

// Черновик карточки книги от AI (D-14): не сохраняется, библиотекарь правит форму сам
export type BookDraft = { title: string; author: string; isbn: string; copies: number };

export async function draftBook(text: string): Promise<BookDraft> {
  const res = await call('POST', '/api/ai/book-draft', { text });
  return (await res.json()) as BookDraft;
}

export async function me(): Promise<Me> {
  const res = await call('GET', '/api/auth/me');
  return (await res.json()) as Me;
}

export async function logout(): Promise<void> {
  await call('POST', '/api/auth/logout');
}

// Только путь своего сайта: начинается ровно с одного `/` (не `//`, не `/\`). Иначе — /v2/.
// Защита от открытого перенаправления через параметр next (T-08-31).
export function safeNext(raw: string | null): string {
  if (raw === null) return DEFAULT_NEXT;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return DEFAULT_NEXT;
  // Управляющие символы браузер вырезает из адреса: `/<tab>/evil` стал бы `//evil`
  for (const char of raw) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return DEFAULT_NEXT;
  }
  return raw;
}

// Адрес страницы входа с возвратом на next (D-12)
export function loginUrl(next: string): string {
  return `/login/?next=${encodeURIComponent(next)}`;
}

type AsyncMethods = Record<string, (...args: never[]) => Promise<unknown>>;

// Оборачивает клиент API: результат и ошибка пробрасываются как есть, а на UNAUTHENTICATED
// дополнительно вызывается onUnauthenticated (переход на вход, T-08-36)
export function guardSession<T extends AsyncMethods>(client: T, onUnauthenticated: () => void): T {
  const guarded: AsyncMethods = {};
  for (const [name, method] of Object.entries(client)) {
    guarded[name] = async (...args: never[]) => {
      try {
        return await method(...args);
      } catch (error) {
        if (error instanceof ApiError && error.code === 'UNAUTHENTICATED') onUnauthenticated();
        throw error;
      }
    };
  }
  return guarded as T;
}

// Тексты кодов, которых нет в карте старого клиента (src/client заморожен, D-12).
// Совпадают с колонкой «Текст в UI» docs/api-spec.md; тест live-client.test.ts сверяет их со спекой.
const LIVE_MESSAGES: Record<string, string> = {
  INVALID_JSON: 'Запрос отправлен в неверном формате',
  UNAUTHENTICATED: 'Войдите, чтобы продолжить',
  INVALID_CREDENTIALS: 'Неверный логин или пароль',
  FORBIDDEN: 'У вас нет прав на это действие',
  ORIGIN_NOT_ALLOWED: 'Запрос отклонён: неизвестный источник',
  NOT_FOUND: 'Страница или адрес не найдены',
  BOOK_HAS_ACTIVE_LOANS: 'Книгу нельзя удалить: она на руках у читателя',
  BOOK_HAS_LOAN_HISTORY: 'Книгу нельзя удалить: по ней есть история выдач',
  READER_HAS_ACTIVE_LOANS: 'Читателя нельзя удалить: у него есть книги на руках',
  READER_HAS_LOAN_HISTORY: 'Читателя нельзя удалить: у него есть история выдач',
  COPIES_BELOW_ACTIVE_LOANS: 'Экземпляров не может быть меньше, чем выдано',
  LOGIN_TAKEN: 'Этот логин уже занят',
  READER_ALREADY_HAS_ACCOUNT: 'У этого читателя уже есть учётная запись',
  CONFLICT: 'Данные изменились, обновите страницу и повторите',
  TOO_MANY_ATTEMPTS: 'Слишком много попыток входа, подождите и повторите',
  AI_LIMIT_REACHED: 'Дневной лимит подсказок AI исчерпан',
  STORAGE_ERROR: 'Не удалось прочитать или записать данные',
  AI_UPSTREAM_ERROR: 'Сервис подсказок недоступен, заполните поля вручную',
  AI_BAD_RESPONSE: 'AI вернул неподходящий ответ, заполните поля вручную',
  DB_BUSY: 'Система занята, повторите через несколько секунд',
  DB_UNAVAILABLE: 'База данных недоступна, повторите позже',
  AI_DISABLED: 'Подсказки AI отключены',
  AI_TIMEOUT: 'Сервис подсказок не ответил вовремя',
};

// Текст для пользователя только по коду: details и сообщения сервера в интерфейс не попадают (T-08-35).
// Коды старого клиента и сетевой сбой — его тексты, остальное — карта LIVE_MESSAGES.
export function liveErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return LIVE_MESSAGES[error.code] ?? errorMessage(error);
  return errorMessage(error);
}
