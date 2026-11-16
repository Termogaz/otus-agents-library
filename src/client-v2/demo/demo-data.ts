// Вымышленные данные для прототипа: ни настоящих названий, ни имён, ни контактов.
// Все даты считаются от переданного `now`, поэтому просрочка и «На руках» не устаревают.

import type { BookView, LoanView, ReaderView } from '../../client/api';

export type DemoData = {
  books: BookView[];
  readers: ReaderView[];
  loans: LoanView[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Дата за `days` суток до `now`; отрицательное значение — в будущем
function daysAgo(now: Date, days: number): string {
  return new Date(now.getTime() - days * DAY_MS).toISOString();
}

// Срок возврата: 14 суток от даты выдачи (как в политике домена)
function dueAfter(now: Date, issuedDaysAgo: number): string {
  return daysAgo(now, issuedDaysAgo - 14);
}

type LoanSeed = {
  id: string;
  bookId: string;
  readerId: string;
  issuedDaysAgo: number;
  returnedDaysAgo: number | null;
};

// Выдачи сценария. Читатель r1 держит три книги (лимит), единственный экземпляр b2 у него.
const LOAN_SEEDS: readonly LoanSeed[] = [
  { id: 'l1', bookId: 'b2', readerId: 'r1', issuedDaysAgo: 2, returnedDaysAgo: null },
  { id: 'l2', bookId: 'b5', readerId: 'r1', issuedDaysAgo: 1, returnedDaysAgo: null },
  { id: 'l3', bookId: 'b6', readerId: 'r1', issuedDaysAgo: 5, returnedDaysAgo: null },
  // Просроченная: выдана за 20 суток, срок вышел 6 суток назад
  { id: 'l4', bookId: 'b3', readerId: 'r2', issuedDaysAgo: 20, returnedDaysAgo: null },
  // «На руках»: выдана за 3 суток
  { id: 'l5', bookId: 'b1', readerId: 'r3', issuedDaysAgo: 3, returnedDaysAgo: null },
  // Возвращённая: выдана за 30 суток, возвращена за 18
  { id: 'l6', bookId: 'b4', readerId: 'r4', issuedDaysAgo: 30, returnedDaysAgo: 18 },
];

const BOOK_SEEDS = [
  { id: 'b1', title: 'Демо-книга «Первая»', author: 'Демо-автор Первый', copies: 3 },
  { id: 'b2', title: 'Демо-книга «Единственная»', author: 'Демо-автор Второй', copies: 1 },
  { id: 'b3', title: 'Демо-книга «Просроченная»', author: 'Демо-автор Третий', copies: 2 },
  { id: 'b4', title: 'Демо-книга «Возвращённая»', author: 'Демо-автор Четвёртый', copies: 2 },
  { id: 'b5', title: 'Демо-книга «Пятая»', author: 'Демо-автор Пятый', copies: 2 },
  { id: 'b6', title: 'Демо-книга «Шестая»', author: 'Демо-автор Шестой', copies: 3 },
] as const;

export function createDemoData(now: Date): DemoData {
  const loans: LoanView[] = LOAN_SEEDS.map((seed) => ({
    id: seed.id,
    bookId: seed.bookId,
    readerId: seed.readerId,
    issuedAt: daysAgo(now, seed.issuedDaysAgo),
    dueAt: dueAfter(now, seed.issuedDaysAgo),
    returnedAt: seed.returnedDaysAgo === null ? null : daysAgo(now, seed.returnedDaysAgo),
    overdue: false,
  }));
  // Просрочка: не возвращена и срок уже прошёл
  for (const loan of loans) {
    loan.overdue = loan.returnedAt === null && now.getTime() > Date.parse(loan.dueAt);
  }

  const books: BookView[] = BOOK_SEEDS.map((seed, index) => {
    const issued = loans.filter((l) => l.bookId === seed.id && l.returnedAt === null).length;
    return {
      ...seed,
      isbn: `000-0-00-${String(index + 1).padStart(6, '0')}-0`,
      available: Math.max(seed.copies - issued, 0),
    };
  });

  const readers: ReaderView[] = [
    { id: 'r1', name: 'Демо-читатель Первый', contact: 'demo-reader-1@example.test' },
    { id: 'r2', name: 'Демо-читатель Второй', contact: 'demo-reader-2@example.test' },
    { id: 'r3', name: 'Демо-читатель Третий', contact: 'demo-reader-3@example.test' },
    { id: 'r4', name: 'Демо-читатель Четвёртый', contact: 'demo-reader-4@example.test' },
  ];

  return { books, readers, loans };
}
