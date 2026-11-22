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
