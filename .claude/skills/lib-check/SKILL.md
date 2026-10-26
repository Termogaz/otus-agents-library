---
name: lib-check
description: Полная проверка проекта — npm run check (типы, ESLint, Prettier, Vitest) с кратким итогом. Использовать перед тем, как назвать шаг готовым, и перед коммитом.
allowed-tools: Read, Grep, Glob, Bash(npm run check)
---

# Полная проверка

1. Запусти `npm run check` (по `AGENTS.md` это обязательная проверка перед «готово»).
2. Если всё зелёное — ответь одной строкой: `✅ npm run check: N тестов, типы/lint/format чистые`.
3. Если упало — определи, на каком этапе (`typecheck` → `lint` → `format:check` → `test`; цепочка
   останавливается на первом упавшем), и выведи:

```text
❌ npm run check — упал этап <этап>
- `файл:строка` — суть ошибки (по одной строке на ошибку, не больше 10)
Дальше: <что исправить первым>
```

Ничего не исправляй и не запускай `npm run format` сам — только отчёт. Если упал `format:check`,
подскажи `npm run format`. Если в diff есть `src/client/` или `tests/e2e/`, напомни, что для UI
нужен ещё `npm run test:e2e` (через `env -u http_proxy ...`, см. `AGENTS.md`).
