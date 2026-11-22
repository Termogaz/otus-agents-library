-- 001: книги, читатели, выдачи (docs/architecture.md, «Схема данных»).
-- Применённый файл менять нельзя: контрольная сумма записана в schema_migrations.

-- Роль приложения видит схему, но не создаёт в ней объекты
revoke all on schema public from public;
grant usage on schema public to library_api;

create table books (
  id text primary key,
  title text not null,
  author text not null,
  -- isbn не уникален: в реальных данных есть книги с одинаковым ISBN
  isbn text not null,
  copies integer not null check (copies >= 0)
);

create table readers (
  id text primary key,
  name text not null,
  contact text not null
);

create table loans (
  id text primary key,
  book_id text not null references books (id) on delete restrict,
  reader_id text not null references readers (id) on delete restrict,
  issued_at timestamptz not null,
  due_at timestamptz not null check (due_at > issued_at),
  -- null: книга ещё у читателя
  returned_at timestamptz
);

-- Подсчёт активных выдач книги и выдачи читателя
create index loans_active_book_idx on loans (book_id) where returned_at is null;
create index loans_reader_idx on loans (reader_id);

grant select, insert, update, delete on books, readers, loans to library_api;

-- Число активных выдач по книгам. SECURITY DEFINER: читатель видит доступность
-- экземпляров, не видя чужих выдач.
create function active_loan_counts()
returns table (book_id text, active integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select book_id, count(*)::int from loans where returned_at is null group by book_id
$$;

revoke execute on function active_loan_counts() from public;
grant execute on function active_loan_counts() to library_api;
