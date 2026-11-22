import { useId, useRef, useState, type FormEvent } from 'react';
import type { BookView } from '../../client/api';
import { ListState, type LoadState } from '@/components/ListState';
import { StatusMessage, type Outcome } from '@/components/StatusMessage';
import type { BookDraft } from '../api/live-client';
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
  // Черновик карточки по свободному тексту; null — отказ (итог показан в App). Без пропа блок
  // «Заполнить из текста» не рисуется: прототип, демо и страница читателя не меняются
  onDraft?: (text: string) => Promise<BookDraft | null>;
};

const MAX_DRAFT_LENGTH = 2000;

export function BooksSection({ books, load, outcome, onAdd, onDraft }: Props) {
  const headingId = useId();
  const { busy, guarded } = useBusy();
  const draftBusy = useBusy();
  const [draftOpen, setDraftOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const draftTextId = useId();
  const draftHintId = useId();
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

  // Черновик только заполняет поля формы: сохраняет книгу библиотекарь кнопкой «Добавить»
  function fillForm(draft: BookDraft) {
    const form = formRef.current;
    if (!form) return;
    const values: Record<string, string> = {
      title: draft.title,
      author: draft.author,
      isbn: draft.isbn,
      copies: String(draft.copies),
    };
    for (const [name, value] of Object.entries(values)) {
      const field = form.elements.namedItem(name);
      if (field instanceof HTMLInputElement) field.value = value;
    }
  }

  async function submitDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onDraft) return;
    const text = String(new FormData(event.currentTarget).get('draft'));
    const draft = await draftBusy.guarded(() => onDraft(text));
    if (draft) fillForm(draft);
  }

  return (
    <Card role="region" aria-labelledby={headingId} className="p-4 md:p-6">
      <h2 id={headingId} className="text-lg font-semibold">
        Книги
      </h2>
      {onDraft && (
        <div className="flex flex-col gap-4">
          <div>
            <Button
              type="button"
              variant="outline"
              aria-expanded={draftOpen}
              onClick={() => setDraftOpen((open) => !open)}
              className="max-md:w-full"
            >
              Заполнить из текста
            </Button>
          </div>
          {draftOpen && (
            <form
              aria-label="Заполнить из текста"
              onSubmit={(e) => void submitDraft(e)}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor={draftTextId}>Описание книги</Label>
                <textarea
                  id={draftTextId}
                  name="draft"
                  required
                  maxLength={MAX_DRAFT_LENGTH}
                  rows={4}
                  aria-describedby={draftHintId}
                  className="min-h-24 w-full min-w-0 rounded-lg border border-input bg-card px-3 py-2 text-base placeholder:text-muted-foreground hover:border-muted-foreground focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:bg-disabled-bg disabled:text-disabled-text aria-invalid:border-destructive user-invalid:border-destructive"
                />
                <p id={draftHintId} className="text-sm text-text-muted">
                  Черновик заполнит AI — проверьте поля перед сохранением
                </p>
              </div>
              <div>
                <Button type="submit" disabled={draftBusy.busy} className="max-md:w-full">
                  Заполнить
                </Button>
              </div>
            </form>
          )}
          {outcome?.place === 'draft' && <StatusMessage outcome={outcome} />}
        </div>
      )}
      <form
        ref={formRef}
        aria-label="Добавить книгу"
        onSubmit={(e) => void submit(e)}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-4">
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
          <Button ref={buttonRef} type="submit" disabled={busy} className="max-md:w-full">
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
  );
}
