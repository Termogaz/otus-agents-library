-- 004: суточный лимит запросов к AI на пользователя (D-14).
-- Применённый файл менять нельзя: контрольная сумма записана в schema_migrations.

create table ai_usage (
  user_id uuid not null references users(id) on delete cascade,
  day date not null,
  count integer not null check (count >= 1),
  primary key (user_id, day)
);

-- FORCE подчиняет политикам и владельца таблицы
alter table ai_usage enable row level security;
alter table ai_usage force row level security;

-- Библиотекарь видит и меняет только собственные строки учёта
create policy ai_usage_self on ai_usage for all to library_api
  using (app_role() = 'librarian' and user_id::text = app_user_id())
  with check (app_role() = 'librarian' and user_id::text = app_user_id());

-- Владелец читает всё (диагностика); писать ему политика не даёт
create policy ai_usage_owner_read on ai_usage for select to library_owner using (true);

grant select, insert, update on ai_usage to library_api;
