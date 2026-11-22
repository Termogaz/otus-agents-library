import { useCallback, useEffect, useRef, useState } from 'react';
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react';
import { errorMessage, type api as ApiClient } from '../client/api';
import type { BookView, LoanView, ReaderView } from '../client/api';
import type { LoadState } from '@/components/ListState';
import {
  StatusMessage,
  type Outcome,
  type OutcomeKind,
  type OutcomePlace,
} from '@/components/StatusMessage';
import { VariantFooter, type Variant } from '@/components/VariantFooter';
import { BooksSection } from '@/features/BooksSection';
import { LoansSection } from '@/features/LoansSection';
import { ReadersSection } from '@/features/ReadersSection';
import type { BookDraft } from './api/live-client';
import { formatDate, readDueAt } from './loan-view';

// Запись прошла, но списки не перечитались: это не отказ, страницу нужно обновить
const SAVED_TEXT = 'Сохранено, но список не обновился. Обновите страницу';

type Api = typeof ApiClient;

type Props = {
  api: Api;
  // `server` — настоящий API (страница /v2/), `demo` — адаптер в памяти (страница /prototype/)
  mode: 'server' | 'demo';
  // Текущий вариант: его ссылка в подвале помечается как текущая
  variant: Variant;
  // Текст отказа для пользователя; по умолчанию — тексты старого клиента
  describeError?: (e: unknown) => string;
  // Черновик книги от AI; передаётся только странице /v2/ библиотекаря, иначе блока нет
  draftBook?: (text: string) => Promise<BookDraft>;
};

// Итог черновика: какие поля AI не нашёл в тексте и их надо заполнить вручную
function draftSummary(draft: BookDraft): string {
  const missing = [
    !draft.title && 'название',
    !draft.author && 'автор',
    !draft.isbn && 'ISBN',
  ].filter((name): name is string => Boolean(name));
  if (missing.length === 0) return 'Черновик готов. Проверьте поля перед сохранением';
  return `Черновик готов. Не распознаны: ${missing.join(', ')} — заполните вручную`;
}

export function App({ api, mode, variant, describeError = errorMessage, draftBook }: Props) {
  const [books, setBooks] = useState<BookView[]>([]);
  const [readers, setReaders] = useState<ReaderView[]>([]);
  const [loans, setLoans] = useState<LoanView[]>([]);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [apiStatus, setApiStatus] = useState('проверка...');
  // Состояние первой загрузки: после неё раздел в «Загрузку» не возвращается (FR-1)
  const [load, setLoad] = useState<LoadState>('loading');

  // Номер итога: новый итог получает новый id и входит заново (D-07)
  const outcomeCount = useRef(0);
  const showOutcome = useCallback((kind: OutcomeKind, place: OutcomePlace, text: string) => {
    outcomeCount.current += 1;
    setOutcome({ id: outcomeCount.current, kind, place, text });
  }, []);

  const refresh = useCallback(async () => {
    const [b, r, l] = await Promise.all([api.listBooks(), api.listReaders(), api.listLoans()]);
    setBooks(b);
    setReaders(r);
    setLoans(l);
  }, [api]);

  // Первая загрузка: ошибка идёт единым итогом вверху страницы (FR-2)
  useEffect(() => {
    refresh()
      .then(() => {
        setLoad('ready');
        setApiStatus(mode === 'demo' ? 'демо-данные' : 'ok');
      })
      .catch((e: unknown) => {
        setLoad('failed');
        setApiStatus(mode === 'demo' ? 'демо-данные' : 'недоступен');
        showOutcome('error', 'page', describeError(e));
      });
  }, [refresh, mode, showOutcome, describeError]);

  // Действие пользователя. Старый итог виден до конца запроса, новый заменяет его целиком (FR-2).
  // Действие и обновление списков в разных try: сбой чтения после успешной записи — не отказ (FR-5)
  async function run(
    place: OutcomePlace,
    action: () => Promise<unknown>,
    successText: (result: unknown) => string,
  ): Promise<boolean> {
    let result: unknown;
    try {
      result = await action();
    } catch (e) {
      showOutcome('error', place, describeError(e));
      return false;
    }
    try {
      await refresh();
      // Если первая загрузка сорвалась, а теперь списки прочитаны, таблицы показываются как обычно
      setLoad('ready');
      setApiStatus(mode === 'demo' ? 'демо-данные' : 'ok');
      showOutcome('success', place, successText(result));
    } catch {
      showOutcome('saved', place, SAVED_TEXT);
    }
    return true;
  }

  function checkout(bookId: string, readerId: string) {
    const title = books.find((b) => b.id === bookId)?.title ?? bookId;
    const name = readers.find((r) => r.id === readerId)?.name ?? readerId;
    return run(
      'checkout',
      () => api.checkout(bookId, readerId),
      (result) => {
        const dueAt = readDueAt(result);
        const term = dueAt === null ? '' : `. Срок: ${formatDate(dueAt)}`;
        return `Выдано: «${title}», ${name}${term}`;
      },
    );
  }

  function returnLoan(loanId: string) {
    const loan = loans.find((l) => l.id === loanId);
    const title = books.find((b) => b.id === loan?.bookId)?.title ?? '';
    const name = readers.find((r) => r.id === loan?.readerId)?.name ?? '';
    return run(
      'return',
      () => api.returnLoan(loanId),
      () => `Принято: «${title}», ${name}`,
    );
  }

  // Черновик не пишет в хранилище и списки не перечитывает: итог — подсказка проверить поля
  async function draft(text: string): Promise<BookDraft | null> {
    if (!draftBook) return null;
    try {
      const result = await draftBook(text);
      showOutcome('success', 'draft', draftSummary(result));
      return result;
    } catch (e) {
      showOutcome('error', 'draft', describeError(e));
      return null;
    }
  }

  // MotionConfig и LazyMotion в корне: анимации только на /v2/ и /prototype/ (D-05, D-07)
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>
        <main className="mx-auto flex max-w-content flex-col gap-6 p-4 md:p-6">
          <h1 className="text-xl font-semibold">Библиотека</h1>
          {outcome?.place === 'page' && <StatusMessage outcome={outcome} />}

          <LoansSection
            books={books}
            readers={readers}
            loans={loans}
            load={load}
            outcome={outcome}
            onCheckout={checkout}
            onReturn={returnLoan}
          />

          {/* Книги и читатели рядом 5:3 от 768 px, ниже — столбцом (DESIGN.md «Отступы и раскладка») */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,3fr)]">
            <BooksSection
              books={books}
              load={load}
              outcome={outcome}
              {...(draftBook ? { onDraft: draft } : {})}
              onAdd={(book) =>
                run(
                  'books',
                  () => api.addBook(book),
                  () => `Книга «${book.title}» добавлена`,
                )
              }
            />

            <ReadersSection
              readers={readers}
              load={load}
              outcome={outcome}
              onAdd={(reader) =>
                run(
                  'readers',
                  () => api.addReader(reader),
                  () => `Читатель ${reader.name} добавлен`,
                )
              }
            />
          </div>

          <footer className="flex flex-col gap-2 text-sm text-text-muted">
            <p>API: {apiStatus}</p>
            <VariantFooter current={variant} />
          </footer>
        </main>
      </LazyMotion>
    </MotionConfig>
  );
}
