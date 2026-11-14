import { useCallback, useEffect, useState } from 'react';
import { errorMessage, type api as ApiClient } from '../client/api';
import type { BookView, LoanView, ReaderView } from '../client/api';
import type { LoadState } from '@/components/ListState';
import { StatusMessage, type Outcome, type OutcomePlace } from '@/components/StatusMessage';
import { BooksSection } from '@/features/BooksSection';
import { LoansSection } from '@/features/LoansSection';
import { ReadersSection } from '@/features/ReadersSection';
import { formatDate, readDueAt } from './loan-view';

// Запись прошла, но списки не перечитались: это не отказ, страницу нужно обновить
const SAVED_TEXT = 'Сохранено, но список не обновился. Обновите страницу';

type Api = typeof ApiClient;

type Props = {
  api: Api;
  // `server` — настоящий API (страница /v2/), `demo` — адаптер в памяти (страница /prototype/)
  mode: 'server' | 'demo';
};

export function App({ api, mode }: Props) {
  const [books, setBooks] = useState<BookView[]>([]);
  const [readers, setReaders] = useState<ReaderView[]>([]);
  const [loans, setLoans] = useState<LoanView[]>([]);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [apiStatus, setApiStatus] = useState('проверка...');
  // Состояние первой загрузки: после неё раздел в «Загрузку» не возвращается (FR-1)
  const [load, setLoad] = useState<LoadState>('loading');

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
        setOutcome({ kind: 'error', place: 'page', text: errorMessage(e) });
      });
  }, [refresh, mode]);

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
      setOutcome({ kind: 'error', place, text: errorMessage(e) });
      return false;
    }
    try {
      await refresh();
      // Если первая загрузка сорвалась, а теперь списки прочитаны, таблицы показываются как обычно
      setLoad('ready');
      setApiStatus(mode === 'demo' ? 'демо-данные' : 'ok');
      setOutcome({ kind: 'success', place, text: successText(result) });
    } catch {
      setOutcome({ kind: 'saved', place, text: SAVED_TEXT });
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

  return (
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

      <footer className="text-sm text-text-muted">API: {apiStatus}</footer>
    </main>
  );
}
