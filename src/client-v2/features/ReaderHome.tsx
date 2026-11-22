import { useEffect, useId, useState } from 'react';
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react';
import type { api as ApiClient } from '../../client/api';
import type { BookView, LoanView } from '../../client/api';
import { ListState, type LoadState } from '@/components/ListState';
import { StatusMessage, type Outcome } from '@/components/StatusMessage';
import { VariantFooter } from '@/components/VariantFooter';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { liveErrorMessage, type Me } from '../api/live-client';
import { formatDate, loanStatus, orderLoans } from '../loan-view';

type Props = {
  api: Pick<typeof ApiClient, 'listBooks' | 'listLoans'>;
  me: Me;
};

// «Мои книги» читателя: каталог и свои выдачи, без форм записи (D-12).
// Чужие выдачи отсекает сервер (RLS, D-06): клиент ничего не фильтрует.
export function ReaderHome({ api }: Props) {
  const catalogId = useId();
  const loansId = useId();
  const [books, setBooks] = useState<BookView[]>([]);
  const [loans, setLoans] = useState<LoanView[]>([]);
  const [load, setLoad] = useState<LoadState>('loading');
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useEffect(() => {
    Promise.all([api.listBooks(), api.listLoans()])
      .then(([b, l]) => {
        setBooks(b);
        setLoans(l);
        setLoad('ready');
      })
      .catch((e: unknown) => {
        setLoad('failed');
        setOutcome({ id: 1, kind: 'error', place: 'page', text: liveErrorMessage(e) });
      });
  }, [api]);

  const titleOf = (bookId: string) => books.find((b) => b.id === bookId)?.title ?? bookId;

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>
        <main className="mx-auto flex max-w-content flex-col gap-6 p-4 md:p-6">
          <h1 className="text-xl font-semibold">Мои книги</h1>
          {outcome !== null && <StatusMessage outcome={outcome} />}

          <Card role="region" aria-labelledby={catalogId} className="p-4 md:p-6">
            <h2 id={catalogId} className="text-lg font-semibold">
              Каталог
            </h2>
            <ListState load={load} empty={books.length === 0 ? 'Книг пока нет' : null}>
              <Table containerLabel="Таблица каталога">
                <TableCaption>Каталог</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Название</TableHead>
                    <TableHead>Автор</TableHead>
                    <TableHead>Свободно</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {books.map((book) => (
                    <TableRow key={book.id}>
                      <TableCell>{book.title}</TableCell>
                      <TableCell>{book.author}</TableCell>
                      <TableCell>
                        {book.available} из {book.copies}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ListState>
          </Card>

          <Card role="region" aria-labelledby={loansId} className="p-4 md:p-6">
            <h2 id={loansId} className="text-lg font-semibold">
              Мои выдачи
            </h2>
            <ListState load={load} empty={loans.length === 0 ? 'У вас нет выданных книг' : null}>
              <Table containerLabel="Таблица моих выдач">
                <TableCaption>Мои выдачи</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Книга</TableHead>
                    <TableHead>Выдана</TableHead>
                    <TableHead>Вернуть до</TableHead>
                    <TableHead>Статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderLoans(loans).map((loan) => (
                    <TableRow key={loan.id}>
                      <TableCell>{titleOf(loan.bookId)}</TableCell>
                      <TableCell>{formatDate(loan.issuedAt)}</TableCell>
                      <TableCell>{formatDate(loan.dueAt)}</TableCell>
                      <TableCell>{loanStatus(loan)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ListState>
          </Card>

          <footer className="text-sm text-text-muted">
            <VariantFooter current="v2" />
          </footer>
        </main>
      </LazyMotion>
    </MotionConfig>
  );
}
