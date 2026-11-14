import { useId, useRef, type FormEvent } from 'react';
import type { BookView } from '../../client/api';
import { ListState, type LoadState } from '@/components/ListState';
import { StatusMessage, type Outcome } from '@/components/StatusMessage';
import { useBusy } from '../use-busy';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Props = {
  books: BookView[];
  load: LoadState;
  outcome: Outcome | null;
  onAdd: (book: Omit<BookView, 'id' | 'available'>) => Promise<boolean>;
};

export function BooksSection({ books, load, outcome, onAdd }: Props) {
  const headingId = useId();
  const { busy, guarded } = useBusy();
  const titleRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const authorId = useId();
  const isbnId = useId();
  const copiesId = useId();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // currentTarget обнуляется после первого await, поэтому форма берётся заранее
    const form = event.currentTarget;
    const data = new FormData(form);
    const added = await guarded(() =>
      onAdd({
        title: String(data.get('title')),
        author: String(data.get('author')),
        isbn: String(data.get('isbn')),
        copies: Number(data.get('copies')),
      }),
    );
    // Повторный клик во время запроса отброшен: итог первого действия ещё впереди
    if (added === undefined) return;
    if (added) {
      form.reset();
      // После успеха фокус на первом поле: можно сразу вносить следующую книгу
      titleRef.current?.focus();
    } else {
      // Отказ: фокус на кнопке, итог под ней
      buttonRef.current?.focus();
    }
  }

  return (
    <section aria-labelledby={headingId}>
      <Card>
        <h2 id={headingId} className="text-lg font-semibold">
          Книги
        </h2>
        <form
          aria-label="Добавить книгу"
          onSubmit={(e) => void submit(e)}
          className="flex flex-col gap-4"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor={titleId}>Название</Label>
              <Input id={titleId} ref={titleRef} name="title" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={authorId}>Автор</Label>
              <Input id={authorId} name="author" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={isbnId}>ISBN</Label>
              <Input id={isbnId} name="isbn" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={copiesId}>Экземпляров</Label>
              <Input id={copiesId} name="copies" type="number" min={1} defaultValue={1} required />
            </div>
          </div>
          <div>
            <Button ref={buttonRef} type="submit" disabled={busy}>
              Добавить
            </Button>
          </div>
          {outcome?.place === 'books' && <StatusMessage outcome={outcome} />}
        </form>

        <ListState
          load={load}
          empty={books.length === 0 ? 'Каталог пуст. Добавьте первую книгу.' : null}
        >
          <Table containerLabel="Таблица книг">
            <TableCaption>Книги</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Автор</TableHead>
                <TableHead>ISBN</TableHead>
                <TableHead>Свободно</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {books.map((book) => (
                <TableRow key={book.id}>
                  <TableCell>{book.title}</TableCell>
                  <TableCell>{book.author}</TableCell>
                  <TableCell>{book.isbn}</TableCell>
                  <TableCell>
                    {book.available} из {book.copies}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ListState>
      </Card>
    </section>
  );
}
