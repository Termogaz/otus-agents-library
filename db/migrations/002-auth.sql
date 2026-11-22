-- 002: учётные записи и сессии (D-05, D-06). RLS здесь не включается: политики добавляет 003.
-- Применённый файл менять нельзя: контрольная сумма записана в schema_migrations.

create table users (
  id uuid primary key default gen_random_uuid(),
  login text not null constraint users_login_unique unique,
  -- scrypt$N$r$p$соль$хеш; роль приложения этот столбец не читает
  password_hash text not null,
  role text not null check (role in ('librarian', 'reader')),
  -- учётка читателя исчезает вместе с читателем
  reader_id text constraint users_reader_unique unique references readers (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- читатель привязан к карточке читателя, библиотекарь — нет
  check ((role = 'reader') = (reader_id is not null))
);

create table sessions (
  -- sha256 токена в hex; сам токен есть только в cookie браузера
  token_hash text primary key,
  user_id uuid not null references users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index sessions_user_idx on sessions (user_id);

-- Роль приложения не ходит в sessions и не читает password_hash: поиск сессии и пароля
-- идёт только через функции ниже
revoke all on users, sessions from library_api;
grant select (id, login, role, reader_id, created_at) on users to library_api;
grant insert (id, login, password_hash, role, reader_id) on users to library_api;
grant update (login, password_hash) on users to library_api;
grant delete on users to library_api;

-- Пользователь при входе ещё неизвестен, поэтому поиск идёт от владельца (SECURITY DEFINER)
create function auth_find_user_for_login(p_login text)
returns table (user_id uuid, password_hash text, role text, reader_id text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.id, u.password_hash, u.role, u.reader_id from users u where u.login = p_login
$$;

-- Заодно убирает истёкшие сессии, чтобы таблица не росла без предела
create function auth_create_session(p_token_hash text, p_user_id uuid, p_expires_at timestamptz)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from sessions where expires_at <= now();
  insert into sessions (token_hash, user_id, expires_at) values (p_token_hash, p_user_id, p_expires_at);
$$;

create function auth_delete_session(p_token_hash text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from sessions where token_hash = p_token_hash
$$;

create function auth_resolve_session(p_token_hash text)
returns table (user_id uuid, login text, role text, reader_id text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.id, u.login, u.role, u.reader_id
  from sessions s join users u on u.id = s.user_id
  where s.token_hash = p_token_hash and s.expires_at > now()
$$;

revoke execute on function auth_find_user_for_login(text) from public;
revoke execute on function auth_create_session(text, uuid, timestamptz) from public;
revoke execute on function auth_delete_session(text) from public;
revoke execute on function auth_resolve_session(text) from public;
grant execute on function auth_find_user_for_login(text) to library_api;
grant execute on function auth_create_session(text, uuid, timestamptz) to library_api;
grant execute on function auth_delete_session(text) to library_api;
grant execute on function auth_resolve_session(text) to library_api;
