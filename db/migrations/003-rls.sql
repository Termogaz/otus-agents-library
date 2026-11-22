-- 003: Row Level Security (D-06). Права проверяются и в маршруте, и здесь: ошибка в маршруте
-- не открывает чужие данные.
-- Применённый файл менять нельзя: контрольная сумма записана в schema_migrations.

-- Контекст запроса кладёт в GUC транзакции сервер (set_config(..., true)). Пустая строка и
-- отсутствие значения одинаково дают null: ни одна политика такой запрос не пропускает.
-- app_user_id() остаётся text: нестандартное значение не должно ронять запрос ошибкой 22P02,
-- поэтому в политиках сравнение идёт как id::text = app_user_id().
create function app_role() returns text
language sql stable
as $$ select nullif(current_setting('app.role', true), '') $$;

create function app_reader_id() returns text
language sql stable
as $$ select nullif(current_setting('app.reader_id', true), '') $$;

create function app_user_id() returns text
language sql stable
as $$ select nullif(current_setting('app.user_id', true), '') $$;

grant execute on function app_role(), app_reader_id(), app_user_id() to library_api;

-- FORCE подчиняет политикам и владельца таблиц (library_owner не суперпользователь)
alter table books enable row level security;
alter table books force row level security;
alter table readers enable row level security;
alter table readers force row level security;
alter table loans enable row level security;
alter table loans force row level security;
alter table users enable row level security;
alter table users force row level security;

-- Каталог: читают библиотекарь и читатель, пишет только библиотекарь
create policy books_read on books for select to library_api
  using (app_role() in ('librarian', 'reader'));
create policy books_write on books for all to library_api
  using (app_role() = 'librarian') with check (app_role() = 'librarian');

-- Читатели: библиотекарь — все, читатель — только свою карточку
create policy readers_lib on readers for all to library_api
  using (app_role() = 'librarian') with check (app_role() = 'librarian');
create policy readers_self on readers for select to library_api
  using (app_role() = 'reader' and id = app_reader_id());

-- Выдачи: библиотекарь — все, читатель — только свои и только чтение
create policy loans_lib on loans for all to library_api
  using (app_role() = 'librarian') with check (app_role() = 'librarian');
create policy loans_self on loans for select to library_api
  using (app_role() = 'reader' and reader_id = app_reader_id());

-- Учётки: библиотекарь — все, читатель — только свою
create policy users_lib on users for all to library_api
  using (app_role() = 'librarian') with check (app_role() = 'librarian');
create policy users_self on users for select to library_api
  using (id::text = app_user_id());

-- Функции SECURITY DEFINER выполняются от library_owner, а FORCE подчиняет владельца
-- политикам. Им нужно только чтение; писать владелец по-прежнему не может.
create policy books_owner_read on books for select to library_owner using (true);
create policy readers_owner_read on readers for select to library_owner using (true);
create policy loans_owner_read on loans for select to library_owner using (true);
create policy users_owner_read on users for select to library_owner using (true);

-- sessions без RLS: у library_api на неё нет прав (002), доступ только через функции auth_*
