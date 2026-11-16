import { useId, useRef, type FormEvent } from 'react';
import type { ReaderView } from '../../client/api';
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
  readers: ReaderView[];
  load: LoadState;
  outcome: Outcome | null;
  onAdd: (reader: Omit<ReaderView, 'id'>) => Promise<boolean>;
};

export function ReadersSection({ readers, load, outcome, onAdd }: Props) {
  const headingId = useId();
  const { busy, guarded } = useBusy();
  const nameRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const nameId = useId();
  const contactId = useId();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // currentTarget обнуляется после первого await, поэтому форма берётся заранее
    const form = event.currentTarget;
    const data = new FormData(form);
    const added = await guarded(() =>
      onAdd({
        name: String(data.get('name')),
        contact: String(data.get('contact')),
      }),
    );
    // Повторный клик во время запроса отброшен: итог первого действия ещё впереди
    if (added === undefined) return;
    if (added) {
      form.reset();
      // После успеха фокус на первом поле: можно сразу вносить следующего читателя
      nameRef.current?.focus();
    } else {
      // Отказ: фокус на кнопке, итог под ней
      buttonRef.current?.focus();
    }
  }

  return (
    <Card role="region" aria-labelledby={headingId} className="p-4 md:p-6">
      <h2 id={headingId} className="text-lg font-semibold">
        Читатели
      </h2>
      <form
        aria-label="Добавить читателя"
        onSubmit={(e) => void submit(e)}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={nameId}>Имя</Label>
            <Input id={nameId} ref={nameRef} name="name" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={contactId}>Контакт</Label>
            <Input id={contactId} name="contact" required />
          </div>
        </div>
        <div>
          <Button ref={buttonRef} type="submit" disabled={busy} className="max-md:w-full">
            Добавить
          </Button>
        </div>
        {outcome?.place === 'readers' && <StatusMessage outcome={outcome} />}
      </form>

      <ListState
        load={load}
        empty={readers.length === 0 ? 'Читателей пока нет. Добавьте первого читателя.' : null}
      >
        <Table containerLabel="Таблица читателей">
          <TableCaption>Читатели</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Имя</TableHead>
              <TableHead>Контакт</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {readers.map((reader) => (
              <TableRow key={reader.id}>
                <TableCell>{reader.name}</TableCell>
                <TableCell>{reader.contact}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ListState>
    </Card>
  );
}
