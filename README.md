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

Режим по умолчанию — `acceptEdits`: правки видны в git и проверяются hooks, а рискованные команды
остаются под allow / ask / deny.

**Контекст.** При старте сессии агент читает `CLAUDE.md`, а через него `AGENTS.md` (правила
для любого агента) и `.planning/STATE.md` (текущая позиция и прогресс; план вехи — в
`.planning/ROADMAP.md`). Журнал `docs/memory.md` хранит, что сделано, какие решения приняты,
что дальше и где были ловушки. По нему новая сессия продолжает работу с того места, где
остановилась прошлая.

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
   ведут команды GSD в `.planning/ROADMAP.md` и `.planning/STATE.md`, итог записывается в
   `docs/memory.md`.
7. Ревью перед PR запускает человек командой `/review-step`. Его делает read-only subagent
   `reviewer`, замечания исправляются в той же ветке.
8. Push и PR — только с подтверждения человека, merge делает человек.

**Права и ограничения агента.** Мягкие правила (`AGENTS.md`, rules) дублируются жёсткими там,
где ошибка дорого стоит. Права заданы в `.claude/settings.json`:

- allow (без вопросов): `npm run check`, `npm test`, `npm run lint`, `npm run typecheck`,
  `npm run format`, `npx vitest run`, e2e, read-only git (`status`, `diff`, `log`, `show`,
  просмотр веток `git branch` без удаления и переименования), `git add`, `git commit`;
- ask (подтверждает человек): `git push`, `gh pr create`, `gh pr merge`, `npm install`;
- deny: чтение и правка `.env*`, правка `package-lock.json`, `rm -rf`, `git push --force`,
  `git push origin main`, `npm publish`;
- hook `protect-files` блокирует запись в `.env*`, `.git/` и `package-lock.json`, в том числе
  через Bash;
- hook `reviewer-readonly` не даёт ревьюеру менять файлы.

Эти проверки сверяют шаблоны команд, это не песочница. Hooks работают только после `npm ci`:
без него они не запускаются, и защита молча пропадает. Что они ловят и как их можно обойти —
в разделе «Ограничения» [`docs/about.md`](docs/about.md#ограничения).

**Как запустить тесты.**

```bash
npm test                                                     # все unit и API тесты
npx vitest run tests/unit/loans.test.ts -t "<имя теста>"     # один тест
npm run test:e2e                                             # e2e, сам поднимает npm run dev
npm run check                                                # типы, линтер, форматирование, unit
```

Если npm ходит через локальный HTTP-прокси, e2e падает по таймауту `webServer`. Тогда запускать
так: `env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY npm run test:e2e`.

## Что не воспроизводится из git

Эти части среды живут вне репозитория или в `.gitignore`. После клонирования их нужно поставить
заново, команды запускать в своём терминале.

**Память claude-mem 15.0.1.** Плагин, worker и база наблюдений лежат в `~/.claude/plugins/` и
`~/.claude-mem/`, база личная и в git не попадает.

```bash
CLAUDE_MEM_TELEMETRY=off DO_NOT_TRACK=1 npx -y claude-mem@15.0.1 install
# провайдер — Anthropic Max Plan (без облачной синхронизации), модель сжатия — Haiku 4.5
npx -y claude-mem@15.0.1 telemetry disable
# маскирование секретов по умолчанию выключено — включить сразу после установки
node -e 'const fs=require("fs"),f=process.env.HOME+"/.claude-mem/settings.json",s=JSON.parse(fs.readFileSync(f,"utf8"));s.CLAUDE_MEM_REDACT_ENABLED="true";s.CLAUDE_MEM_REDACT_GENERIC_ENABLED="true";fs.writeFileSync(f,JSON.stringify(s,null,2)+"\n")'
npx -y claude-mem@15.0.1 restart
npx -y claude-mem@15.0.1 doctor   # ожидается «All required checks passed», worker на :37700
```

Без `CLAUDE_MEM_REDACT_ENABLED` claude-mem сохраняет секреты из вывода команд и в сыром виде, и
в сжатых наблюдениях — это показала канарейка с фальшивым ключом (`docs/memory.md`, шаг 3).
Если `doctor` ругается на `Hook launcher`, удалить глобальный пакет: `npm uninstall -g claude-mem`.

**GSD и `.claude/settings.local.json`.** Команды, агенты и hooks `gsd-*` ставит установщик GSD,
он же пишет их в `.claude/settings.local.json`. Нужен Node ≥ 24 (через nvm).

```bash
npx @opengsd/gsd-core@1.18.0 --claude --local
```

Если npm ходит через локальный прокси и падает с `ECONNRESET`, все команды выше запускать через
`env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY`.

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
