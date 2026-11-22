#!/bin/sh
# Роли и базы приложения. Образ postgres выполняет скрипты из /docker-entrypoint-initdb.d
# только один раз, на пустом томе: после правки скрипта dev-том пересоздают (down -v).
# Права на схему и таблицы выдаёт миграция 001, не этот скрипт.
set -eu

# Heredoc в одинарных кавычках: оболочка ничего не подставляет, пароли попадают в psql
# переменными, а интерполяция :'имя' экранирует значение как строковый литерал.
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres \
  -v owner_pw="$LIBRARY_OWNER_PASSWORD" -v api_pw="$LIBRARY_API_PASSWORD" <<'SQL'
-- Владелец таблиц и миграций: не суперпользователь, RLS на него распространяется (FORCE).
create role library_owner login password :'owner_pw' nosuperuser nobypassrls;
-- Роль приложения: никогда не владелец таблиц и без BYPASSRLS.
create role library_api login password :'api_pw' nosuperuser nobypassrls;
-- Владелец выполняет set role library_api в пробах RLS.
grant library_api to library_owner;

create database library owner library_owner;
create database library_test owner library_owner;

revoke connect on database library from public;
revoke connect on database library_test from public;
grant connect on database library, library_test to library_api;
SQL
