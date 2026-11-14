import { useId, useRef, type FormEvent } from 'react';
import type { ReaderView } from '../../client/api';
import { StatusMessage, type Outcome } from '@/components/StatusMessage';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = {
  outcome: Outcome | null;
  onAdd: (reader: Omit<ReaderView, 'id'>) => Promise<boolean>;
};

// Таблица читателей и тексты пустого списка добавляются в плане 07-05
export function ReadersSection({ outcome, onAdd }: Props) {
  const headingId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const nameId = useId();
  const contactId = useId();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // currentTarget обнуляется после первого await, поэтому форма берётся заранее
    const form = event.currentTarget;
    const data = new FormData(form);
    const added = await onAdd({
      name: String(data.get('name')),
      contact: String(data.get('contact')),
    });
    if (added) {
      form.reset();
      // После успеха фокус на первом поле: можно сразу вносить следующего читателя
      nameRef.current?.focus();
    }
  }

  return (
    <section aria-labelledby={headingId}>
      <Card>
        <h2 id={headingId} className="text-lg font-semibold">
          Читатели
        </h2>
        <form
          aria-label="Добавить читателя"
          onSubmit={(e) => void submit(e)}
          className="flex flex-col gap-4"
        >
          <div className="grid gap-4 md:grid-cols-2">
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
            <Button type="submit">Добавить</Button>
          </div>
          {outcome?.place === 'readers' && <StatusMessage outcome={outcome} />}
        </form>
      </Card>
    </section>
  );
}
