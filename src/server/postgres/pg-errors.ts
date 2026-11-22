import pg from 'pg';

export type HttpError = { status: number; code: string };

// 57014 — отмена запроса по statement_timeout (другой отмены сервер не делает)
const BUSY_CODES = new Set(['40001', '40P01', '55P03', '57014']);
const CONNECTION_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'ECONNRESET']);

// Сообщения pg-pool, когда соединение получить не удалось
const CONNECT_TIMEOUT = /timeout exceeded when trying to connect|connection timeout/i;

// Безопасный ответ клиенту по ошибке БД: только статус и код, текст ошибки (схема, значения)
// остаётся в логе сервера. Для неизвестной ошибки — undefined.
export function httpErrorFromDatabase(error: unknown): HttpError | undefined {
  if (error instanceof pg.DatabaseError) {
    // 42501: нарушение политики RLS или нет права на таблицу
    if (error.code === '42501') return { status: 403, code: 'FORBIDDEN' };
    // 23505: уникальность, 23503: внешний ключ
    if (error.code === '23505' || error.code === '23503') return { status: 409, code: 'CONFLICT' };
    // Сериализация, взаимная блокировка, таймаут блокировки или запроса: запрос можно повторить
    if (error.code && BUSY_CODES.has(error.code)) return { status: 503, code: 'DB_BUSY' };
    return undefined;
  }

  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    if ((code && CONNECTION_CODES.has(code)) || CONNECT_TIMEOUT.test(error.message)) {
      return { status: 503, code: 'DB_UNAVAILABLE' };
    }
  }
  return undefined;
}
