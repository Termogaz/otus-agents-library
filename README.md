# Библиотека

Веб-приложение библиотеки: книги с несколькими экземплярами, читатели, выдача и возврат,
лимит книг на читателя, срок выдачи и просрочка. Учебный проект курса OTUS «AI Agents»: код
написан coding-агентом Claude Code в настроенной для него среде.

Стек: TypeScript, Express 5 + zod, React + Vite, хранилище в JSON-файле, Vitest + supertest,
Playwright. Подробный отчёт со скриншотами — [`docs/about.md`](docs/about.md).

## Запуск

Нужен Node.js 22 или новее.

```bash
npm ci
npm run dev        # API на :3000, UI на http://localhost:5173
```

Данные хранятся в `data/library.json`. Другой файл можно указать через переменную
`LIBRARY_DATA_FILE`.

| Задача           | Команда                                                    |
| ---------------- | ---------------------------------------------------------- |
| Unit и API тесты | `npm test`                                                 |
| E2E              | `npm run test:e2e` (сам поднимает `npm run dev`)           |
| Полная проверка  | `npm run check` (типы, линтер, форматирование, unit-тесты) |

## Как агент работает в проекте

Режим по умолчанию — `acceptEdits`: агент правит файлы без вопросов, а команды проходят через
permissions из `.claude/settings.json`.

**Контекст.** При старте сессии агент читает `CLAUDE.md`, а через него `AGENTS.md` (правила
для любого агента) и `docs/plan.md` (план и прогресс). Журнал `docs/memory.md` хранит, что
сделано, какие решения приняты, что дальше и где были ловушки. По нему новая сессия
продолжает работу с того места, где остановилась прошлая.

**Цикл шага.**

1. Агент предлагает шаг: зачем он нужен и что будет сделано. Работа начинается только после
   подтверждения.
2. Ветка `feat/<кратко>` или `fix/<кратко>`, в `main` — только через Pull Request.
3. Бизнес-правила и API — по TDD. Skill `write-tests` агент вызывает сам: сначала падающий
   тест, потом код. Для `src/domain/` и `tests/e2e/` подгружаются свои rules из `.claude/rules/`.
4. После каждой правки hook `format-and-lint` запускает Prettier и ESLint. Ошибки сразу
   возвращаются агенту.
5. UI агент проверяет сам в браузере через Playwright MCP (`.mcp.json`).
6. Шаг готов, когда `npm run check` зелёный, а для UI — ещё и `npm run test:e2e`. Прогресс
   отмечается в `docs/plan.md`, итог записывается в `docs/memory.md`.
7. Ревью перед PR запускает человек командой `/review-step`. Его делает read-only subagent
   `reviewer`, замечания исправляются в той же ветке.
8. Push и PR — только с подтверждения человека, merge делает человек.

**Ограничения агента.** Мягкие правила (`AGENTS.md`, rules) дублируются жёсткими там, где
ошибка дорого стоит:

- permissions: нельзя читать `.env*`, править `package-lock.json`, делать `rm -rf`,
  `git push --force`, `git push origin main`, `npm publish`; `git push` и `npm install`
  требуют подтверждения;
- hook `protect-files` блокирует запись в `.env*`, `.git/` и `package-lock.json`, в том числе
  через Bash;
- hook `reviewer-readonly` не даёт ревьюеру менять файлы.

Эти проверки сверяют шаблоны команд, это не песочница. Hooks работают только после `npm ci`:
без него они не запускаются, и защита молча пропадает. Что они ловят и как их можно обойти —
в разделе «Ограничения» [`docs/about.md`](docs/about.md#ограничения).

## Структура

```text
src/domain/   бизнес-правила: чистые функции без I/O
src/server/   Express: маршруты, валидация zod, хранилище
src/client/   React UI
tests/unit/   Vitest; tests/e2e/ — Playwright
docs/         about.md (отчёт), plan.md (план), memory.md (журнал), screenshots/
.claude/      rules, skills, agents, hooks, settings.json
.mcp.json     Playwright MCP для проверки UI агентом
```
