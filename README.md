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

## Модуль 2: агентно-ориентированный пайплайн

Задание — [`docs/homework-2.md`](docs/homework-2.md). Вся работа сделана в ветке `feat/module-2`
как веха GSD из пяти фаз: план и прогресс — [`.planning/ROADMAP.md`](.planning/ROADMAP.md), требования
с отметками — [`.planning/REQUIREMENTS.md`](.planning/REQUIREMENTS.md). Архитектура среды агента по
слоям (инструкции, планирование, память, hooks, контекст) — [`docs/architecture.md`](docs/architecture.md).
Ход работы по шагам, с решениями и ловушками — [`docs/memory.md`](docs/memory.md).

Команды вида `/…` вводятся в сессии Claude Code, остальные — в терминале из корня проекта.

| Пункт ДЗ                                   | Артефакты                                                                                                                                                                                                                                                                                                                     | Команда проверки                                                                                                                                                                             | Скриншоты                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. gsd-core, проект инициирован            | [`ROADMAP.md`](.planning/ROADMAP.md), [`STATE.md`](.planning/STATE.md), [`REQUIREMENTS.md`](.planning/REQUIREMENTS.md), [`architecture.md`](docs/architecture.md), [`security-checklist.md`](docs/security-checklist.md); полный цикл GSD — [фаза 1](.planning/phases/01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti/) | `/gsd-progress`; `npx vitest run tests/unit/protect-files.test.ts tests/unit/secret-names.test.ts tests/unit/reviewer-readonly.test.ts tests/unit/shell.test.ts` (439 тестов обходов `.env`) | [`/gsd-progress`](docs/screenshots/hw2-plan01-progress.png)                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2. Память агента                           | claude-mem 15.0.1 (вне git, установка — ниже); запасной вариант — [`docs/memory.md`](docs/memory.md) + дайджест [`session-start.ts`](.claude/hooks/session-start.ts)                                                                                                                                                          | `npx -y claude-mem@15.0.1 doctor`; в новой сессии: «Какое кодовое имя у следующей фичи?» — факта нет в репозитории                                                                           | [сессия A](docs/screenshots/hw2-mem03-session-a.png), [сессия B](docs/screenshots/hw2-mem03-session-b.png); без claude-mem — [плагины выключены](docs/screenshots/hw2-mem04-plugins-off.png), [ответ по дайджесту](docs/screenshots/hw2-mem04-digest-answer.png)                                                                                                                                                                                                 |
| 3. Быстрые команды и auto hooks            | [`.claude/skills/lib-*`](.claude/skills/), hooks [`session-start.ts`](.claude/hooks/session-start.ts), [`pre-compact.ts`](.claude/hooks/pre-compact.ts), регистрация — [`.claude/settings.json`](.claude/settings.json)                                                                                                       | `/lib-status`, `/lib-check`, `/hooks`; `npx vitest run tests/unit/session-start.test.ts tests/unit/pre-compact.test.ts tests/unit/lib-skills.test.ts tests/unit/format-and-lint.test.ts`     | [`/lib-status`](docs/screenshots/hw2-hook01-status.png), [`/lib-check`](docs/screenshots/hw2-hook01-check.png), [`/lib-handoff`](docs/screenshots/hw2-hook01-handoff.png), [`/lib-commit`](docs/screenshots/hw2-hook01-commit.png), [`/hooks`](docs/screenshots/hw2-hook02-hooks-menu.png), [дайджест](docs/screenshots/hw2-hook02-session-answer.png), [чек-пойнт](docs/screenshots/hw2-hook03-compact.png)                                                     |
| 4. Управление контекстом, usage до и после | `autoCompactWindow: 200000` в [`.claude/settings.json`](.claude/settings.json), чек-пойнт `PreCompact` → `SessionStart(compact)`, statusline и монитор GSD, политика — раздел «Контекст» в [`AGENTS.md`](AGENTS.md), замеры — [`docs/context-usage.md`](docs/context-usage.md)                                                | `/context` (строка «Auto-compact window: 200k tokens»); `npx vitest run tests/unit/settings-permissions.test.ts -t "auto-compact window"`                                                    | usage [до](docs/screenshots/hw2-usage-before.png) / [после](docs/screenshots/hw2-usage-after.png); `/context` [до](docs/screenshots/hw2-context-before-progress.png) / [после](docs/screenshots/hw2-context-after-progress.png); [сжатие вручную](docs/screenshots/hw2-ctx02-manual.png), [автосжатие](docs/screenshots/hw2-ctx02-auto.png), [statusline](docs/screenshots/hw2-ctx03-statusline.png), [WARNING монитора](docs/screenshots/hw2-ctx03-warning.png) |
| 5. Discovery в GSD                         | [`renewal-and-fines.md`](.planning/notes/renewal-and-fines.md) (`/gsd-explore`), [`04-SPEC.md`](.planning/phases/04-discovery-prodlenie-i-peni/04-SPEC.md), [`04-CONTEXT.md`](.planning/phases/04-discovery-prodlenie-i-peni/04-CONTEXT.md)                                                                                   | `git diff --stat ca429d0 -- src tests` — пусто: Discovery код не менял                                                                                                                       | [пустой diff и артефакты](docs/screenshots/hw2-disc01-diff.png)                                                                                                                                                                                                                                                                                                                                                                                                  |

### Итог Discovery «продление и пени»

Пройдено `/gsd-explore` → `/gsd-spec-phase` (неоднозначность 0.17 при пороге 0.20) → `/gsd-discuss-phase`.
Открытые вопросы — в разделе SPEC, решения D-01…D-10 — в CONTEXT.

**Решили:**

- Продление: +14 дней от текущего срока, не больше 2 раз. Просроченную выдачу и выдачу должника не продлить.
- Пеня: 10 ₽ за каждые начатые сутки просрочки, не больше 300 ₽ на выдачу. Считается в целых копейках.
- Читатель с неоплаченной пеней не может взять новую книгу. Пеню можно отметить оплаченной только целиком
  и только после возврата книги.
- Ставка, потолок и лимит продлений хранятся в `LoanPolicy`. Правила пеней — в `src/domain/fines.ts`.
- Формат хранилища v1→v2 мигрирует при чтении файла. Повреждённый файл отклоняется целиком. Выдачи из v1
  освобождены от пени (`fineExempt`), задним числом ничего не начисляется.

**Отложили:**

- Реализацию (домен, API, UI, миграция) — на следующую веху (LOAN-01).
- Очередь и бронь, уведомления, кассу и частичную оплату, прощение пени, роли.
- Резервную копию файла перед миграцией и перенос миграций на SQLite.

## Что не воспроизводится из git

Эти части среды живут вне репозитория или в `.gitignore`. После клонирования их нужно поставить
заново, команды запускать в своём терминале.

| Что                              | Где лежит                                                | Как восстановить                                        |
| -------------------------------- | -------------------------------------------------------- | ------------------------------------------------------- |
| claude-mem: плагин, worker, база | `~/.claude/plugins/`, `~/.claude-mem/`                   | установка ниже; база личная, переносить не нужно        |
| GSD Core: команды, агенты, hooks | `.claude/gsd-*`, `.claude/{agents,commands,hooks}/gsd-*` | `npx @opengsd/gsd-core@1.18.0 --claude --local`         |
| Hooks GSD и statusline           | `.claude/settings.local.json`                            | hooks пишет установщик GSD; statusline — фрагмент ниже  |
| Auto memory Claude Code          | `~/.claude/projects/<проект>/memory/`                    | личная, создаётся сама; общий журнал — `docs/memory.md` |
| Чек-пойнты сжатия                | `.local/checkpoints/last.md`                             | создаёт hook `PreCompact` при первом сжатии             |
| Служебный файл GSD               | `.planning/state.json`                                   | создаёт GSD, в git не берётся                           |

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

GSD закреплён на версии 1.18.0, подсказку `/gsd-update` в statusline не выполнять.

**Statusline и монитор контекста.** Установщик GSD регистрирует монитор `gsd-context-monitor.js`,
но statusline не включает, а без файла метрик statusline монитор молчит. Добавить в
`.claude/settings.local.json`:

```json
"statusLine": {
  "type": "command",
  "command": "node \"${CLAUDE_PROJECT_DIR:-$PWD}\"/.claude/hooks/gsd-statusline.js"
}
```

Шкала появляется после первого ответа в сессии. WARNING монитора приходит при остатке ≤35% до порога
сжатия, CRITICAL — при ≤25%.

Если npm ходит через локальный прокси и падает с `ECONNRESET`, все команды выше запускать через
`env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY`.

## Структура

```text
src/domain/   бизнес-правила: чистые функции без I/O
src/server/   Express: маршруты, валидация zod, хранилище
src/client/   React UI
tests/unit/   Vitest; tests/e2e/ — Playwright
docs/         about.md (отчёт ДЗ-1), architecture.md (среда агента), memory.md (журнал),
              context-usage.md, security-checklist.md, screenshots/
.planning/    GSD: ROADMAP, REQUIREMENTS, STATE, фазы, карта кода
.claude/      rules, skills, agents, hooks, settings.json
.mcp.json     Playwright MCP для проверки UI агентом
```
