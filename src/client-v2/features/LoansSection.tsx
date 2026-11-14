import { useId, useRef, useState, type FormEvent } from 'react';
import type { BookView, LoanView, ReaderView } from '../../client/api';
import { ListState, type LoadState } from '@/components/ListState';
import { StatusMessage, type Outcome } from '@/components/StatusMessage';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { activeLoanCount, formatDate, loanStatus, orderLoans } from '../loan-view';
import { useBusy } from '../use-busy';

type Props = {
  books: BookView[];
  readers: ReaderView[];
  loans: LoanView[];
  load: LoadState;
  outcome: Outcome | null;
  onCheckout: (bookId: string, readerId: string) => Promise<boolean>;
  onReturn: (loanId: string) => Promise<boolean>;
};

export function LoansSection({
  books,
  readers,
  loans,
  load,
  outcome,
  onCheckout,
  onReturn,
}: Props) {
  // Выбор не сбрасывается после выдачи: удобно выдать ещё раз или увидеть отказ (FR-5)
  const [bookId, setBookId] = useState('');
  const [readerId, setReaderId] = useState('');
  const { busy, guarded } = useBusy();
  const checkoutRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();

  const titles = new Map(books.map((b) => [b.id, b.title]));
  const names = new Map(readers.map((r) => [r.id, r.name]));

  // Подсказки FR-6 только показывают числа из уже загруженных данных и ничего не блокируют:
  // можно ли выдать книгу, решает сервер
  const selectedBook = books.find((b) => b.id === bookId);
  const bookHint = selectedBook
    ? `Свободно: ${selectedBook.available} из ${selectedBook.copies}`
    : '';
  const readerHint = readers.some((r) => r.id === readerId)
    ? `На руках: ${activeLoanCount(loans, readerId)}`
    : '';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const done = await guarded(() => onCheckout(bookId, readerId));
    // Повторный клик во время запроса отброшен: фокус вернёт первое действие
    if (done === undefined) return;
    // И после выдачи, и после отказа фокус на кнопке: итог рядом с ней (ux-patterns)
    checkoutRef.current?.focus();
  }

  return (
    <Card role="region" aria-labelledby={headingId} className="p-4 md:p-6">
      <h2 id={headingId} className="text-lg font-semibold">
        Выдачи
      </h2>
      <form
        aria-label="Выдать книгу"
        onSubmit={(e) => void submit(e)}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <div className="flex min-w-0 flex-col gap-2 md:flex-1">
            <Label htmlFor="loan-book">Книга</Label>
            <NativeSelect
              id="loan-book"
              aria-describedby="loan-book-hint"
              value={bookId}
              onChange={(e) => setBookId(e.target.value)}
              required
            >
              <option value="">Выберите книгу</option>
              {books.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.title}
                </option>
              ))}
            </NativeSelect>
            <FieldHint id="loan-book-hint">{bookHint}</FieldHint>
          </div>
          <div className="flex min-w-0 flex-col gap-2 md:flex-1">
            <Label htmlFor="loan-reader">Читатель</Label>
            <NativeSelect
              id="loan-reader"
              aria-describedby="loan-reader-hint"
              value={readerId}
              onChange={(e) => setReaderId(e.target.value)}
              required
            >
              <option value="">Выберите читателя</option>
              {readers.map((reader) => (
                <option key={reader.id} value={reader.id}>
                  {reader.name}
                </option>
              ))}
            </NativeSelect>
            <FieldHint id="loan-reader-hint">{readerHint}</FieldHint>
          </div>
          {/* Отступ сверху равен высоте подписи с зазором (24 + 8 px): кнопка на уровне полей */}
          <Button ref={checkoutRef} type="submit" disabled={busy} className="max-md:w-full md:mt-8">
            Выдать
          </Button>
        </div>
        {outcome?.place === 'checkout' && <StatusMessage outcome={outcome} />}
      </form>

      {outcome?.place === 'return' && <StatusMessage outcome={outcome} takeFocus />}

      <ListState load={load} empty={loansEmptyText(books, readers, loans)}>
        {/* @container: ширина блока для колонок узкой таблицы, см. styles.css */}
        <div className="@container">
          <Table containerLabel="Таблица выдач" role="table" className="loans-table">
            <TableCaption>Выдачи</TableCaption>
            <TableHeader role="rowgroup">
              <TableRow role="row">
                <TableHead role="columnheader">Книга</TableHead>
                <TableHead role="columnheader">Читатель</TableHead>
                <TableHead role="columnheader">Выдана</TableHead>
                <TableHead role="columnheader">Вернуть до</TableHead>
                <TableHead role="columnheader">Статус</TableHead>
                <TableHead role="columnheader">Действие</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody role="rowgroup">
              {orderLoans(loans).map((loan) => {
                // Фон у строки и у каждой ячейки: просроченная закрашена целиком, остальные на surface (DESIGN.md «Статусы выдачи»)
                const tint = loan.overdue ? 'bg-danger-bg' : 'bg-surface';
                return (
                  <TableRow
                    key={loan.id}
                    role="row"
                    className={cn(tint, loan.returnedAt !== null && 'text-text-muted')}
                  >
                    <TableCell role="cell" className={cn('min-w-0', tint)}>
                      {titles.get(loan.bookId) ?? loan.bookId}
                    </TableCell>
                    <TableCell role="cell" className={tint}>
                      {names.get(loan.readerId) ?? loan.readerId}
                    </TableCell>
                    <TableCell role="cell" className={cn('tabular-nums whitespace-nowrap', tint)}>
                      {formatDate(loan.issuedAt)}
                    </TableCell>
                    <TableCell role="cell" className={cn('tabular-nums whitespace-nowrap', tint)}>
                      {formatDate(loan.dueAt)}
                    </TableCell>
                    <TableCell role="cell" className={cn(statusClass(loan), tint)}>
                      {loanStatus(loan)}
                    </TableCell>
                    <TableCell role="cell" className={tint}>
                      {loan.returnedAt === null && (
                        <ReturnButton onReturn={() => onReturn(loan.id)} />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </ListState>
    </Card>
  );
}

// Подсказка под полем без живой роли. Строка зарезервирована и при пустом тексте,
// чтобы кнопка и итог не сдвигались при выборе (ux-patterns.md)
function FieldHint({ id, children }: { id: string; children: string }) {
  return (
    <p id={id} className="min-h-5 text-sm text-text-muted">
      {children}
    </p>
  );
}

// Текст пустого списка выдач по тому, чего не хватает для первой выдачи (ux-patterns.md)
function loansEmptyText(
  books: BookView[],
  readers: ReaderView[],
  loans: LoanView[],
): string | null {
  if (loans.length > 0) return null;
  if (books.length === 0 && readers.length === 0) {
    return 'Чтобы выдать книгу, сначала добавьте книгу и читателя ниже.';
  }
  if (books.length === 0) return 'Чтобы выдать книгу, сначала добавьте её в каталог ниже.';
  if (readers.length === 0) return 'Чтобы выдать книгу, сначала добавьте читателя ниже.';
  return 'Выдач пока нет. Выберите книгу и читателя выше.';
}

// Цвет статуса: просрочена — danger, возвращена — text-muted; текст статуса остаётся главным признаком
function statusClass(loan: LoanView): string | undefined {
  if (loan.returnedAt !== null) return 'text-text-muted';
  return loan.overdue ? 'font-semibold text-danger' : undefined;
}

// У каждой строки своя блокировка: соседнее «Вернуть» остаётся доступным (FR-3)
function ReturnButton({ onReturn }: { onReturn: () => Promise<boolean> }) {
  const { busy, guarded } = useBusy();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={() => void guarded(onReturn)}
      className="flex max-md:px-2"
    >
      Вернуть
    </Button>
  );
}
