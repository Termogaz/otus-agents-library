import type { Request, Response } from 'express';
import { z } from 'zod';
import { ApiError } from '../api-error.js';
import type { AiQuota } from '../postgres/ai-quota.js';
import type { RequestContext } from '../storage.js';

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

// Вход маршрута: свободный текст до 2000 символов
export const bookDraftInput = z.object({ text: z.string().trim().min(1).max(2000) });

// Ответ модели — недоверенные данные: проверяется той же строгостью, что и ввод книги
const draftSchema = z.object({
  title: z.string().trim().min(1),
  author: z.string().trim().min(1),
  isbn: z.string(),
  copies: z.number().int().min(1),
});
export type BookDraft = z.infer<typeof draftSchema>;

// Конверт ответа chat completions: нужен только текст первого варианта
const completionSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullish() }) })).min(1),
});

export type AiDeps = {
  apiKey: string;
  model: string;
  dailyLimit: number;
  quota: AiQuota;
  // Подмена сети в тестах; по умолчанию глобальный fetch
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

type ModelDeps = Pick<AiDeps, 'apiKey' | 'model' | 'fetchImpl' | 'timeoutMs'>;

// Слово json в системном сообщении обязательно для режима json_object
const SYSTEM_PROMPT =
  'Ты помощник библиотекаря. Из описания книги извлеки поля и верни только json вида ' +
  '{"title": строка, "author": строка, "isbn": строка, "copies": целое число не меньше 1}. ' +
  'Если isbn неизвестен, верни пустую строку; если число экземпляров не указано, верни 1.';

// В лог идёт только статус апстрима или имя ошибки: без ключа, текста пользователя и ответа
// модели (D-15)
function logFailure(detail: string): void {
  console.error(`AI: ${detail}`);
}

// Вызов модели вместе с чтением тела: таймаут действует на оба шага
async function callModel(text: string, deps: ModelDeps): Promise<unknown> {
  try {
    const res = await (deps.fetchImpl ?? fetch)(DEEPSEEK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deps.apiKey}` },
      body: JSON.stringify({
        model: deps.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
        response_format: { type: 'json_object' },
        thinking: { type: 'disabled' },
        max_tokens: 300,
      }),
      signal: AbortSignal.timeout(deps.timeoutMs ?? 15_000),
    });
    if (!res.ok) {
      logFailure(`апстрим ответил ${res.status}`);
      throw new ApiError(502, 'AI_UPSTREAM_ERROR');
    }
    return await res.json().catch(() => undefined);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const name = error instanceof Error ? error.name : 'неизвестная ошибка';
    logFailure(`сбой вызова (${name})`);
    // AbortSignal.timeout отклоняет вызов с причиной TimeoutError
    if (name === 'TimeoutError') throw new ApiError(504, 'AI_TIMEOUT');
    throw new ApiError(502, 'AI_UPSTREAM_ERROR');
  }
}

function badResponse(): ApiError {
  logFailure('ответ модели не прошёл проверку');
  return new ApiError(502, 'AI_BAD_RESPONSE');
}

export async function requestBookDraft(text: string, deps: ModelDeps): Promise<BookDraft> {
  const body = completionSchema.safeParse(await callModel(text, deps));
  const content = body.success ? body.data.choices[0]?.message.content?.trim() : undefined;
  if (!content) throw badResponse();

  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    throw badResponse();
  }
  const draft = draftSchema.safeParse(raw);
  if (!draft.success) throw badResponse();
  return draft.data;
}

// Обработчик маршрута. Квота берётся отдельной короткой транзакцией до вызова модели, сам вызов
// идёт вне транзакции БД: до 15 с ожидания не должны держать соединение пула.
export function bookDraftHandler(deps: AiDeps, contextOf: (res: Response) => RequestContext) {
  return async (req: Request, res: Response): Promise<void> => {
    const parsed = bookDraftInput.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, 'VALIDATION_ERROR', z.flattenError(parsed.error).fieldErrors);
    }
    // Неудачный вызов модели квоту не возвращает: иначе лимит обходился бы перебором
    // запросов, которые заведомо падают
    if (!(await deps.quota.take(contextOf(res), deps.dailyLimit))) {
      throw new ApiError(429, 'AI_LIMIT_REACHED');
    }
    res.json(await requestBookDraft(parsed.data.text, deps));
  };
}
