import { useId, useRef, useState, type FormEvent } from 'react';
import type { BookView, LoanView, ReaderView } from '../../client/api';
import { StatusMessage, type Outcome } from '@/components/StatusMessage';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate } from '../loan-view';
import { useBusy } from '../use-busy';

type Props = {
  books: BookView[];
  readers: ReaderView[];
  loans: LoanView[];
  outcome: Outcome | null;
  onCheckout: (bookId: string, readerId: string) => Promise<boolean>;
  onReturn: (loanId: string) => Promise<boolean>;
};

export function LoansSection({ books, readers, loans, outcome, onCheckout, onReturn }: Props) {
  // Выбор не сбрасывается после выдачи: удобно выдать ещё раз или увидеть отказ (FR-5)
  const [bookId, setBookId] = useState('');
  const [readerId, setReaderId] = useState('');
  const { busy, guarded } = useBusy();
  const checkoutRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  const bookFieldId = useId();
  const readerFieldId = useId();

  const titles = new Map(books.map((b) => [b.id, b.title]));
  const names = new Map(readers.map((r) => [r.id, r.name]));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const done = await guarded(() => onCheckout(bookId, readerId));
    // Повторный клик во время запроса отброшен: фокус вернёт первое действие
    if (done === undefined) return;
    // И после выдачи, и после отказа фокус на кнопке: итог рядом с ней (ux-patterns)
    checkoutRef.current?.focus();
  }

  return (
    <section aria-labelledby={headingId}>
      <Card>
        <h2 id={headingId} className="text-lg font-semibold">
          Выдачи
        </h2>
        <form
          aria-label="Выдать книгу"
          onSubmit={(e) => void submit(e)}
          className="flex flex-col gap-4"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor={bookFieldId}>Книга</Label>
              <NativeSelect
                id={bookFieldId}
                value={bookId}
                onChange={(e) => setBookId(e.target.value)}
                required
              >
                <option value="">— выберите —</option>
                {books.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.title}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={readerFieldId}>Читатель</Label>
              <NativeSelect
                id={readerFieldId}
                value={readerId}
                onChange={(e) => setReaderId(e.target.value)}
                required
              >
                <option value="">— выберите —</option>
                {readers.map((reader) => (
                  <option key={reader.id} value={reader.id}>
                    {reader.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div>
            <Button ref={checkoutRef} type="submit" disabled={busy}>
              Выдать
            </Button>
          </div>
          {outcome?.place === 'checkout' && <StatusMessage outcome={outcome} />}
        </form>

        {outcome?.place === 'return' && <StatusMessage outcome={outcome} takeFocus />}

        <Table aria-label="Таблица выдач">
          <TableHeader>
            <TableRow>
              <TableHead>Книга</TableHead>
              <TableHead>Читатель</TableHead>
              <TableHead>Выдана</TableHead>
              <TableHead>Срок</TableHead>
              <TableHead>Действие</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loans.map((loan) => (
              <TableRow key={loan.id}>
                <TableCell>{titles.get(loan.bookId) ?? loan.bookId}</TableCell>
                <TableCell>{names.get(loan.readerId) ?? loan.readerId}</TableCell>
                <TableCell>{formatDate(loan.issuedAt)}</TableCell>
                <TableCell>{formatDate(loan.dueAt)}</TableCell>
                <TableCell>
                  {loan.returnedAt === null && <ReturnButton onReturn={() => onReturn(loan.id)} />}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </section>
  );
}

// У каждой строки своя блокировка: соседнее «Вернуть» остаётся доступным (FR-3)
function ReturnButton({ onReturn }: { onReturn: () => Promise<boolean> }) {
  const { busy, guarded } = useBusy();
  return (
    <Button type="button" variant="outline" disabled={busy} onClick={() => void guarded(onReturn)}>
      Вернуть
    </Button>
  );
}
