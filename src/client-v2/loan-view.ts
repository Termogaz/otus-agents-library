// Вспомогательные функции показа выдач: даты, порядок строк, статус и счётчик для подсказки.
// Модуль задаёт только показ и правил выдачи не содержит: просрочку считает сервер (поле `overdue`),
// лимит книг и срок выдачи живут в домене.
import type { LoanView } from '../client/api';

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

// Порядок строк (FR-4): просроченные, затем активные по сроку, затем возвращённые от новых к старым.
// Даты приходят ISO-строками в одном формате (UTC), поэтому сравниваются как строки, без разбора.
// `sort` стабилен: при равных значениях сохраняется порядок ответа сервера. Исходный массив не меняется.
export function orderLoans(loans: readonly LoanView[]): LoanView[] {
  const group = (loan: LoanView): number => {
    if (loan.returnedAt !== null) return 2;
    return loan.overdue ? 0 : 1;
  };
  return [...loans].sort((a, b) => {
    const byGroup = group(a) - group(b);
    if (byGroup !== 0) return byGroup;
    if (a.returnedAt !== null && b.returnedAt !== null) {
      // Возвращённые: новые выше
      return a.returnedAt < b.returnedAt ? 1 : a.returnedAt > b.returnedAt ? -1 : 0;
    }
    // Активные: ближайший срок выше
    return a.dueAt < b.dueAt ? -1 : a.dueAt > b.dueAt ? 1 : 0;
  });
}

// Число активных выдач читателя по уже загруженному списку (подсказка FR-6, ничего не блокирует)
export function activeLoanCount(loans: readonly LoanView[], readerId: string): number {
  return loans.filter((loan) => loan.readerId === readerId && loan.returnedAt === null).length;
}

// Статус выдачи текстом: цвет строки дополняет текст, но не заменяет его
export function loanStatus(loan: LoanView): string {
  if (loan.returnedAt !== null) return `Возвращена ${formatDate(loan.returnedAt)}`;
  return loan.overdue ? 'Просрочена' : 'На руках';
}
