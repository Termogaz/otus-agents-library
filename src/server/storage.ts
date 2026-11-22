import type { LibraryRepository } from './repository.js';

// Кто делает запрос: контекст уходит в БД (GUC транзакции) и читается политиками RLS
export type RequestContext = {
  userId: string | null;
  role: 'librarian' | 'reader';
  readerId: string | null;
};

// Контекст режима без входа: все действия от имени библиотекаря
export const SYSTEM_LIBRARIAN: RequestContext = {
  userId: null,
  role: 'librarian',
  readerId: null,
};

// Единица работы на запрос: fn получает репозиторий, привязанный к этому запросу
export interface Storage {
  run<T>(ctx: RequestContext, fn: (repo: LibraryRepository) => Promise<T>): Promise<T>;
}

// Режим JSON: запросы идут по очереди. Выдача и возврат читают выдачи, проверяют правило и
// сохраняют; без очереди два одновременных запроса выдали бы последний экземпляр дважды.
// Контекст запроса в этом режиме не используется.
export class SerialStorage implements Storage {
  private tail: Promise<unknown> = Promise.resolve();

  constructor(private readonly repo: LibraryRepository) {}

  run<T>(_ctx: RequestContext, fn: (repo: LibraryRepository) => Promise<T>): Promise<T> {
    const result = this.tail.then(() => fn(this.repo));
    // Ошибка предыдущей задачи не должна ломать очередь для следующих
    this.tail = result.catch(() => undefined);
    return result;
  }
}
