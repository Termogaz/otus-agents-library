import type { FormEvent } from 'react';
import type { ReaderView } from './api';

type Props = {
  readers: ReaderView[];
  onAdd: (reader: Omit<ReaderView, 'id'>) => Promise<boolean>;
};

export function ReadersSection({ readers, onAdd }: Props) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const added = await onAdd({
      name: String(data.get('name')),
      contact: String(data.get('contact')),
    });
    if (added) form.reset();
  }

  return (
    <section>
      <h2>Читатели</h2>
      <form aria-label="Добавить читателя" onSubmit={(e) => void submit(e)}>
        <label>
          Имя <input name="name" required />
        </label>
        <label>
          Контакт <input name="contact" required />
        </label>
        <button type="submit">Добавить</button>
      </form>

      <ul aria-label="Читатели">
        {readers.map((reader) => (
          <li key={reader.id}>
            {reader.name} — {reader.contact}
          </li>
        ))}
      </ul>
    </section>
  );
}
