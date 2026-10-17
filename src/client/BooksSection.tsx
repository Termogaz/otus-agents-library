import type { FormEvent } from 'react';
import type { BookView } from './api';

type Props = {
  books: BookView[];
  onAdd: (book: Omit<BookView, 'id' | 'available'>) => Promise<boolean>;
};

export function BooksSection({ books, onAdd }: Props) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const added = await onAdd({
      title: String(data.get('title')),
      author: String(data.get('author')),
      isbn: String(data.get('isbn')),
      copies: Number(data.get('copies')),
    });
    if (added) form.reset();
  }

  return (
    <section>
      <h2>Книги</h2>
      <form aria-label="Добавить книгу" onSubmit={(e) => void submit(e)}>
        <label>
          Название <input name="title" required />
        </label>
        <label>
          Автор <input name="author" required />
        </label>
        <label>
          ISBN <input name="isbn" required />
        </label>
        <label>
          Экземпляров <input name="copies" type="number" min={1} defaultValue={1} required />
        </label>
        <button type="submit">Добавить</button>
      </form>

      <table>
        <caption>Книги</caption>
        <thead>
          <tr>
            <th>Название</th>
            <th>Автор</th>
            <th>ISBN</th>
            <th>Свободно</th>
          </tr>
        </thead>
        <tbody>
          {books.map((book) => (
            <tr key={book.id}>
              <td>{book.title}</td>
              <td>{book.author}</td>
              <td>{book.isbn}</td>
              <td>
                {book.available} из {book.copies}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
