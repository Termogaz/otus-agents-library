# Проверка доступа к БД через MCP

Протокол запросов агента к PostgreSQL через MCP-сервер Postgres MCP Pro. Ответы скопированы из результатов вызовов без правок.

## Подключение

Дата: 2026-11-22.

Сервер `postgres` из `.mcp.json`:

```text
docker run -i --rm -e DATABASE_URI crystaldba/postgres-mcp:0.3.0 --access-mode=unrestricted
```

`DATABASE_URI` берётся из переменной пользователя `LIBRARY_MCP_DATABASE_URI`: роль `library_owner`, база `library` в локальном контейнере через `host.docker.internal:5432`. Переменную задал автор, пароль в репозиторий не попадает.

### Вызов 1: `execute_sql`

Запрос:

```sql
select current_user, rolbypassrls from pg_roles where rolname = current_user
```

Ответ MCP:

```text
[{'current_user': 'library_owner', 'rolbypassrls': False}]
```

Агент подключён ролью `library_owner`, у которой нет права обходить RLS.

### Вызов 2: `list_schemas`

Ответ MCP:

```text
[{'schema_name': 'information_schema', 'schema_owner': 'postgres', 'schema_type': 'System Information Schema'}, {'schema_name': 'pg_catalog', 'schema_owner': 'postgres', 'schema_type': 'System Schema'}, {'schema_name': 'public', 'schema_owner': 'pg_database_owner', 'schema_type': 'User Schema'}]
```

Таблиц ещё нет: миграции появятся в плане 08-03.

## Пробы RLS через MCP

Дата: 2026-11-22. База `library` в локальном контейнере, подключение MCP ролью `library_owner` (см. «Подключение»), пароль в репозиторий не попадает. Миграции 001–003 применены.

Каждая проба — один вызов `execute_sql` без `BEGIN`: MCP-сервер фиксирует вызов отдельной транзакцией, поэтому `set local role library_api` и `set_config(..., true)` действуют только внутри этого вызова. Роль `library_api` — та же, под которой работает приложение; контекст пользователя задают GUC `app.role` и `app.reader_id`, как в `withRequestContext`. Все строки проб помечены префиксом `probe-` и удалены пробой 11.

Перед пробами остаток строк `probe-*` (psql суперпользователя через `docker compose exec`): `0`.

### Проба 1: библиотекарь создаёт книгу, читателей и выдачи

Запрос (первая попытка):

```sql
set local role library_api; select set_config('app.role','librarian',true), set_config('app.reader_id','',true); insert into books(id,title,author,isbn,copies) values ('probe-book','Проба RLS','Агент MCP',null,2); insert into readers(id,name,contact) values ('probe-r1','Проба Читатель 1',null),('probe-r2','Проба Читатель 2',null); insert into loans(id,book_id,reader_id,issued_at,due_at) values ('probe-l1','probe-book','probe-r1','2026-11-22T10:00:00Z','2026-12-06T10:00:00Z'),('probe-l2','probe-book','probe-r2','2026-11-22T10:00:00Z','2026-12-06T10:00:00Z') returning id, reader_id
```

Ответ MCP:

```text
Error: null value in column "isbn" of relation "books" violates not-null constraint
```

Ошибка в данных пробы, а не в политике: `isbn` и `contact` в схеме обязательны. Вызов — одна транзакция, ничего не записано. Запрос повторён с заполненными полями.

Запрос:

```sql
set local role library_api; select set_config('app.role','librarian',true), set_config('app.reader_id','',true); insert into books(id,title,author,isbn,copies) values ('probe-book','Проба RLS','Агент MCP','978-0-00-000000-0',2); insert into readers(id,name,contact) values ('probe-r1','Проба Читатель 1','probe-r1@example.test'),('probe-r2','Проба Читатель 2','probe-r2@example.test'); insert into loans(id,book_id,reader_id,issued_at,due_at) values ('probe-l1','probe-book','probe-r1','2026-11-22T10:00:00Z','2026-12-06T10:00:00Z'),('probe-l2','probe-book','probe-r2','2026-11-22T10:00:00Z','2026-12-06T10:00:00Z') returning id, reader_id
```

Ответ MCP:

```text
[{'id': 'probe-l1', 'reader_id': 'probe-r1'}, {'id': 'probe-l2', 'reader_id': 'probe-r2'}]
```

Вывод: совпало — библиотекарь пишет во все три таблицы (политики `books_write`, `readers_lib`, `loans_lib`).

### Проба 2: библиотекарь видит все выдачи

Запрос:

```sql
set local role library_api; select set_config('app.role','librarian',true), set_config('app.reader_id','',true); select id, reader_id from loans where id like 'probe-%' order by id
```

Ответ MCP:

```text
[{'id': 'probe-l1', 'reader_id': 'probe-r1'}, {'id': 'probe-l2', 'reader_id': 'probe-r2'}]
```

Вывод: совпало — видны обе выдачи.

### Проба 3: читатель видит только свою выдачу

Запрос:

```sql
set local role library_api; select set_config('app.role','reader',true), set_config('app.reader_id','probe-r1',true); select id, reader_id from loans order by id
```

Ответ MCP:

```text
[{'id': 'probe-l1', 'reader_id': 'probe-r1'}]
```

Вывод: совпало — запрос без фильтра вернул только `probe-l1`, выдачу `probe-r2` скрыла политика `loans_self`.

### Проба 4: читатель видит каталог

Запрос:

```sql
set local role library_api; select set_config('app.role','reader',true), set_config('app.reader_id','probe-r1',true); select id, title, copies from books where id like 'probe-%'
```

Ответ MCP:

```text
[{'id': 'probe-book', 'title': 'Проба RLS', 'copies': 2}]
```

Вывод: совпало — каталог читателю открыт (политика `books_read`).

### Проба 5: читатель не может добавить книгу

Запрос:

```sql
set local role library_api; select set_config('app.role','reader',true), set_config('app.reader_id','probe-r1',true); insert into books(id,title,author,isbn,copies) values ('probe-book2','Чужая книга','Читатель','978-0-00-000000-1',1)
```

Ответ MCP:

```text
Error: new row violates row-level security policy for table "books"
```

Вывод: совпало — вставка отклонена политикой; код SQLSTATE `42501` подтверждён пробой 12.

### Проба 6: читатель не может изменить книгу

Запрос:

```sql
set local role library_api; select set_config('app.role','reader',true), set_config('app.reader_id','probe-r1',true); with u as (update books set copies = 99 where id = 'probe-book' returning id) select count(*) as updated from u
```

Ответ MCP:

```text
[{'updated': 0}]
```

Вывод: совпало — для `UPDATE` у читателя нет политики, строка ему не видна, изменено 0 строк.

### Проба 7: без роли не видно ничего

Запрос:

```sql
set local role library_api; select set_config('app.role','',true), set_config('app.reader_id','',true); select (select count(*) from books) as books, (select count(*) from readers) as readers, (select count(*) from loans) as loans
```

Ответ MCP:

```text
[{'books': 0, 'readers': 0, 'loans': 0}]
```

Вывод: совпало — при пустых GUC `app_role()` не совпадает ни с одной ролью, ни одна политика не пропускает; забытый `set_config` не раскрывает данные.

### Проба 8: хеш пароля закрыт колонковой привилегией

Запрос:

```sql
set local role library_api; select set_config('app.role','librarian',true), set_config('app.reader_id','',true); select password_hash from users
```

Ответ MCP:

```text
Error: permission denied for table users
```

Вывод: совпало — даже библиотекарь через `library_api` не читает `password_hash`; пароль проверяет только `SECURITY DEFINER`-функция `auth_*`. Код `42501` подтверждён пробой 12.

### Проба 9: таблица сессий закрыта

Запрос:

```sql
set local role library_api; select set_config('app.role','librarian',true), set_config('app.reader_id','',true); select * from sessions
```

Ответ MCP:

```text
Error: permission denied for table sessions
```

Вывод: совпало — у `library_api` нет прав на `sessions`. Код `42501` подтверждён пробой 12.

### Проба 10: контроль — роль владельца видит все строки

Запрос:

```sql
select current_user, (select count(*) from books where id like 'probe-%') as books, (select count(*) from readers where id like 'probe-%') as readers, (select count(*) from loans where id like 'probe-%') as loans
```

Ответ MCP:

```text
[{'current_user': 'library_owner', 'books': 1, 'readers': 2, 'loans': 2}]
```

Вывод: совпало — строки существуют; пустоту в пробе 7 дала политика, а не отсутствие данных. Владельцу открыто только чтение (`*_owner_read`).

### Проба 12: коды SQLSTATE отказов

Текст ошибки MCP не содержит кода SQLSTATE, поэтому три отказа из проб 5, 8 и 9 повторены в одном блоке `do`: каждый перехвачен, код собран в строку и выведен через `raise exception`. Итоговая ошибка откатывает весь вызов, ничего не записано.

Запрос:

```sql
set local role library_api; select set_config('app.role','reader',true), set_config('app.reader_id','probe-r1',true); do $$ declare r text := ''; begin begin insert into books(id,title,author,isbn,copies) values ('probe-book2','Чужая книга','Читатель','978-0-00-000000-1',1); exception when others then r := r || 'books insert: ' || sqlstate || '; '; end; begin perform password_hash from users; exception when others then r := r || 'users.password_hash: ' || sqlstate || '; '; end; begin perform * from sessions; exception when others then r := r || 'sessions: ' || sqlstate || '; '; end; raise exception 'sqlstate: %', r; end $$
```

Ответ MCP:

```text
Error: sqlstate: books insert: 42501; users.password_hash: 42501; sessions: 42501;
CONTEXT:  PL/pgSQL function inline_code_block line 1 at RAISE
```

Вывод: совпало — все три отказа имеют код `42501` (`insufficient_privilege`); приложение отвечает на него `403` (`pg-errors.ts`).

### Проба 11: уборка

Выполнена после проб 1–10 и 12.

Запрос:

```sql
set local role library_api; select set_config('app.role','librarian',true), set_config('app.reader_id','',true); delete from loans where id like 'probe-%'; delete from readers where id like 'probe-%'; with d as (delete from books where id like 'probe-%' returning id) select count(*) as deleted_books from d
```

Ответ MCP:

```text
[{'deleted_books': 1}]
```

Вывод: совпало — строки удалены в порядке внешних ключей (`restrict`).

### Итог

| Проба | Ожидание                                      | Результат |
| ----- | --------------------------------------------- | --------- |
| 1     | библиотекарь создаёт книгу, читателей, выдачи | совпало   |
| 2     | библиотекарь видит обе выдачи                 | совпало   |
| 3     | читатель видит только свою выдачу             | совпало   |
| 4     | читатель видит каталог                        | совпало   |
| 5     | вставка книги читателем — ошибка RLS (42501)  | совпало   |
| 6     | изменение книги читателем — 0 строк           | совпало   |
| 7     | без роли — 0 строк в books, readers, loans    | совпало   |
| 8     | `password_hash` под `library_api` — 42501     | совпало   |
| 9     | `sessions` под `library_api` — 42501          | совпало   |
| 10    | роль владельца видит строки проб              | совпало   |
| 11    | уборка удаляет строки проб                    | совпало   |
| 12    | коды отказов проб 5, 8, 9 — 42501             | совпало   |

Остаток строк `probe-*` после уборки (psql суперпользователя через `docker compose exec`): `0`.
