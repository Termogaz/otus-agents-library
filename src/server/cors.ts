import type { RequestHandler } from 'express';

// CORS своей middleware, без пакета cors (D-10, D-16). Заголовки получает только origin из
// списка, и ответ всегда содержит его собственное значение: звёздочка вместе с credentials
// запрещена и не используется ни в каком виде.
export function corsMiddleware(allowed: ReadonlySet<string>): RequestHandler {
  return (req, res, next) => {
    const origin = req.get('origin');
    // Ответ зависит от Origin: кэш не должен отдавать его чужому источнику
    res.vary('Origin');
    if (!origin || !allowed.has(origin)) {
      next();
      return;
    }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.status(204).end();
      return;
    }
    next();
  };
}
