import { useState, type FormEvent } from 'react';
import type { BookView, LoanView, ReaderView } from './api';

type Props = {
  books: BookView[];
  readers: ReaderView[];
  loans: LoanView[];
  onCheckout: (bookId: string, readerId: string) => Promise<boolean>;
  onReturn: (loanId: string) => Promise<boolean>;
};

function status(loan: LoanView): string {
  if (loan.returnedAt !== null) return 'Возвращена';
  return loan.overdue ? 'Просрочена' : 'На руках';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU');
}

export function LoansSection({ books, readers, loans, onCheckout, onReturn }: Props) {
  // Выбор не сбрасывается после выдачи: удобно выдать ещё раз или увидеть отказ
  const [bookId, setBookId] = useState('');
  const [readerId, setReaderId] = useState('');

  const titles = new Map(books.map((b) => [b.id, b.title]));
  const names = new Map(readers.map((r) => [r.id, r.name]));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onCheckout(bookId, readerId);
  }

  return (
    <section>
      <h2>Выдачи</h2>
      <form aria-label="Выдать книгу" onSubmit={submit}>
        <label>
          Книга{' '}
          <select value={bookId} onChange={(e) => setBookId(e.target.value)} required>
            <option value="">— выберите —</option>
            {books.map((book) => (
              <option key={book.id} value={book.id}>
                {book.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Читатель{' '}
          <select value={readerId} onChange={(e) => setReaderId(e.target.value)} required>
            <option value="">— выберите —</option>
            {readers.map((reader) => (
              <option key={reader.id} value={reader.id}>
                {reader.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Выдать</button>
      </form>

      <table>
        <caption>Выдачи</caption>
        <thead>
          <tr>
            <th>Книга</th>
            <th>Читатель</th>
            <th>Вернуть до</th>
            <th>Статус</th>
            <th>Действие</th>
          </tr>
        </thead>
        <tbody>
          {loans.map((loan) => (
            <tr key={loan.id}>
              <td>{titles.get(loan.bookId) ?? loan.bookId}</td>
              <td>{names.get(loan.readerId) ?? loan.readerId}</td>
              <td>{formatDate(loan.dueAt)}</td>
              <td>{status(loan)}</td>
              <td>
                {loan.returnedAt === null && (
                  <button type="button" onClick={() => void onReturn(loan.id)}>
                    Вернуть
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
