import type { RequestHandler } from 'express';
import { ApiError } from './api-error.js';

const WRITE_METHODS = new Set(['POST', 'PATCH', 'DELETE']);

function isAllowed(origin: string, allowed: ReadonlySet<string>, host: string | undefined) {
  if (allowed.has(origin)) return true;
  try {
    // Свой хост: страница и API на одном адресе, в том числе dev через прокси Vite
    return host !== undefined && new URL(origin).host === host;
  } catch {
    return false;
  }
}

// Запись с чужим Origin — 403 ORIGIN_NOT_ALLOWED. Дешёвая защита от CSRF поверх SameSite=Lax.
// Запрос без Origin (CLI, curl, supertest) пропускается: браузер Origin на записи шлёт всегда.
export function originCheck(allowed: ReadonlySet<string>): RequestHandler {
  return (req, _res, next) => {
    const origin = req.get('origin');
    if (WRITE_METHODS.has(req.method) && origin !== undefined) {
      if (!isAllowed(origin, allowed, req.get('host'))) {
        throw new ApiError(403, 'ORIGIN_NOT_ALLOWED');
      }
    }
    next();
  };
}
