// Вспомогательные функции показа выдач: даты и срок из ответа сервера.

// ISO-строка в ДД.ММ.ГГГГ по локальной дате; нечитаемая строка возвращается как есть
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${date.getFullYear()}`;
}

// `api.checkout` отдаёт `unknown` (клиент `src/client/api.ts` заморожен): срок читаем сужением типов
export function readDueAt(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return null;
  if (!('dueAt' in value)) return null;
  const dueAt = value.dueAt;
  return typeof dueAt === 'string' ? dueAt : null;
}
