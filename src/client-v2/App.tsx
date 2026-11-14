import { useCallback, useEffect, useState } from 'react';
import { errorMessage, type api as ApiClient } from '../client/api';
import type { BookView, LoanView, ReaderView } from '../client/api';
import { StatusMessage, type Outcome, type OutcomePlace } from '@/components/StatusMessage';
import { LoansSection } from '@/features/LoansSection';

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

  const refresh = useCallback(async () => {
    const [b, r, l] = await Promise.all([api.listBooks(), api.listReaders(), api.listLoans()]);
    setBooks(b);
    setReaders(r);
    setLoans(l);
  }, [api]);

  // Первая загрузка: ошибка идёт единым итогом вверху страницы (FR-2)
  useEffect(() => {
    refresh()
      .then(() => setApiStatus(mode === 'demo' ? 'демо-данные' : 'ok'))
      .catch((e: unknown) => {
        setApiStatus(mode === 'demo' ? 'демо-данные' : 'недоступен');
        setOutcome({ kind: 'error', place: 'page', text: errorMessage(e) });
      });
  }, [refresh, mode]);

  // Действие пользователя: при отказе итог-ошибка на месте действия, старый итог виден до конца запроса
  async function run(place: OutcomePlace, action: () => Promise<unknown>): Promise<boolean> {
    try {
      await action();
    } catch (e) {
      setOutcome({ kind: 'error', place, text: errorMessage(e) });
      return false;
    }
    await refresh();
    setOutcome(null);
    return true;
  }

  return (
    <main className="mx-auto flex max-w-content flex-col gap-6 p-4 md:p-6">
      <h1 className="text-xl font-semibold">Библиотека</h1>
      {outcome?.place === 'page' && <StatusMessage outcome={outcome} />}

      <LoansSection
        books={books}
        readers={readers}
        loans={loans}
        outcome={outcome}
        onCheckout={(bookId, readerId) => run('checkout', () => api.checkout(bookId, readerId))}
      />

      <footer className="text-sm text-text-muted">API: {apiStatus}</footer>
    </main>
  );
}
