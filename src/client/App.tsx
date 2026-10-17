import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage, type BookView, type LoanView, type ReaderView } from './api';
import { BooksSection } from './BooksSection';
import { LoansSection } from './LoansSection';
import { ReadersSection } from './ReadersSection';

export function App() {
  const [apiStatus, setApiStatus] = useState('проверка...');
  const [books, setBooks] = useState<BookView[]>([]);
  const [readers, setReaders] = useState<ReaderView[]>([]);
  const [loans, setLoans] = useState<LoanView[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [b, r, l] = await Promise.all([api.listBooks(), api.listReaders(), api.listLoans()]);
    setBooks(b);
    setReaders(r);
    setLoans(l);
  }, []);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json() as Promise<{ status: string }>)
      .then((body) => setApiStatus(body.status))
      .catch(() => setApiStatus('недоступен'));
    refresh().catch((e: unknown) => setError(errorMessage(e)));
  }, [refresh]);

  // Действие пользователя: при успехе обновить данные, при отказе показать причину
  async function run(action: () => Promise<unknown>): Promise<boolean> {
    try {
      await action();
      setError(null);
      await refresh();
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    }
  }

  return (
    <main>
      <h1>Библиотека</h1>
      <p>API: {apiStatus}</p>
      {error && <p role="alert">{error}</p>}

      <BooksSection books={books} onAdd={(book) => run(() => api.addBook(book))} />
      <ReadersSection readers={readers} onAdd={(reader) => run(() => api.addReader(reader))} />
      <LoansSection
        books={books}
        readers={readers}
        loans={loans}
        onCheckout={(bookId, readerId) => run(() => api.checkout(bookId, readerId))}
        onReturn={(loanId) => run(() => api.returnLoan(loanId))}
      />
    </main>
  );
}
