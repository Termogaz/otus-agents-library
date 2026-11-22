import type pg from 'pg';
import type { Book, Loan, Reader } from '../../domain/index.js';
import type { LibraryRepository, LoanFilter } from '../repository.js';

type BookRow = { id: string; title: string; author: string; isbn: string; copies: number };
type ReaderRow = { id: string; name: string; contact: string };
type LoanRow = {
  id: string;
  book_id: string;
  reader_id: string;
  issued_at: Date;
  due_at: Date;
  returned_at: Date | null;
};

function toBook(row: BookRow): Book {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    isbn: row.isbn,
    copies: row.copies,
  };
}

function toReader(row: ReaderRow): Reader {
  return { id: row.id, name: row.name, contact: row.contact };
}

function toLoan(row: LoanRow): Loan {
  return {
    id: row.id,
    bookId: row.book_id,
    readerId: row.reader_id,
    issuedAt: row.issued_at,
    dueAt: row.due_at,
    returnedAt: row.returned_at,
  };
}

const LOAN_COLUMNS = 'id, book_id, reader_id, issued_at, due_at, returned_at';

// Репозиторий поверх клиента одной транзакции. Все значения идут параметрами $1..$n,
// в текст SQL они не подставляются.
export class PostgresRepository implements LibraryRepository {
  constructor(private readonly client: pg.ClientBase) {}

  async listBooks(): Promise<Book[]> {
    const { rows } = await this.client.query<BookRow>(
      'select id, title, author, isbn, copies from books order by id',
    );
    return rows.map(toBook);
  }

  async getBook(id: string): Promise<Book | undefined> {
    const { rows } = await this.client.query<BookRow>(
      'select id, title, author, isbn, copies from books where id = $1',
      [id],
    );
    return rows[0] ? toBook(rows[0]) : undefined;
  }

  async saveBook(book: Book): Promise<void> {
    await this.client.query(
      `insert into books (id, title, author, isbn, copies) values ($1, $2, $3, $4, $5)
       on conflict (id) do update
       set title = excluded.title, author = excluded.author, isbn = excluded.isbn,
           copies = excluded.copies`,
      [book.id, book.title, book.author, book.isbn, book.copies],
    );
  }

  async listReaders(): Promise<Reader[]> {
    const { rows } = await this.client.query<ReaderRow>(
      'select id, name, contact from readers order by id',
    );
    return rows.map(toReader);
  }

  async getReader(id: string): Promise<Reader | undefined> {
    const { rows } = await this.client.query<ReaderRow>(
      'select id, name, contact from readers where id = $1',
      [id],
    );
    return rows[0] ? toReader(rows[0]) : undefined;
  }

  async saveReader(reader: Reader): Promise<void> {
    await this.client.query(
      `insert into readers (id, name, contact) values ($1, $2, $3)
       on conflict (id) do update set name = excluded.name, contact = excluded.contact`,
      [reader.id, reader.name, reader.contact],
    );
  }

  async listLoans(filter: LoanFilter = {}): Promise<Loan[]> {
    // Необязательные условия: null параметра отключает условие
    const { rows } = await this.client.query<LoanRow>(
      `select ${LOAN_COLUMNS} from loans
       where ($1::text is null or book_id = $1) and ($2::text is null or reader_id = $2)
       order by id`,
      [filter.bookId ?? null, filter.readerId ?? null],
    );
    return rows.map(toLoan);
  }

  async getLoan(id: string): Promise<Loan | undefined> {
    const { rows } = await this.client.query<LoanRow>(
      `select ${LOAN_COLUMNS} from loans where id = $1`,
      [id],
    );
    return rows[0] ? toLoan(rows[0]) : undefined;
  }

  async saveLoan(loan: Loan): Promise<void> {
    await this.client.query(
      `insert into loans (${LOAN_COLUMNS}) values ($1, $2, $3, $4, $5, $6)
       on conflict (id) do update
       set book_id = excluded.book_id, reader_id = excluded.reader_id,
           issued_at = excluded.issued_at, due_at = excluded.due_at,
           returned_at = excluded.returned_at`,
      [loan.id, loan.bookId, loan.readerId, loan.issuedAt, loan.dueAt, loan.returnedAt],
    );
  }
}
