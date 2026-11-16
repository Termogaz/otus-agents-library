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

Цикл разработки с агентом целиком показывает [фаза 1](.planning/phases/01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti/):
обсуждение (`01-CONTEXT.md`, `01-DISCUSSION-LOG.md`) → 9 планов `01-0N-PLAN.md` с отчётами `01-0N-SUMMARY.md` →
ревью кода (`01-REVIEW.md`) и проверка цели фазы (`01-VERIFICATION.md`) → планы закрытия найденных пробелов
(01-06…01-09) и повторная проверка. Фазы 2–5 — настройка среды, Discovery и документация, они выполнены
без отдельных планов GSD (в ROADMAP — «без планов»).

Команды вида `/…` вводятся в сессии Claude Code, остальные — в терминале из корня проекта.

| Пункт ДЗ                                   | Артефакты                                                                                                                                                                                                                                                                                                                     | Команда проверки                                                                                                                                                                             | Скриншоты                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. gsd-core, проект инициирован            | [`ROADMAP.md`](.planning/ROADMAP.md), [`STATE.md`](.planning/STATE.md), [`REQUIREMENTS.md`](.planning/REQUIREMENTS.md), [`architecture.md`](docs/architecture.md), [`security-checklist.md`](docs/security-checklist.md); полный цикл GSD — [фаза 1](.planning/phases/01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti/) | `/gsd-progress`; `npx vitest run tests/unit/protect-files.test.ts tests/unit/secret-names.test.ts tests/unit/reviewer-readonly.test.ts tests/unit/shell.test.ts` (439 тестов обходов `.env`) | [`/gsd-progress`](docs/screenshots/hw2-plan01-progress.png)                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2. Память агента                           | claude-mem 15.0.1 (вне git, установка — ниже); запасной вариант — [`docs/memory.md`](docs/memory.md) + дайджест [`session-start.ts`](.claude/hooks/session-start.ts)                                                                                                                                                          | `npx -y claude-mem@15.0.1 doctor`; в новой сессии: «Какое кодовое имя у следующей фичи?» — факта нет в репозитории                                                                           | [сессия A](docs/screenshots/hw2-mem03-session-a.png), [сессия B](docs/screenshots/hw2-mem03-session-b.png); без claude-mem — [плагины выключены](docs/screenshots/hw2-mem04-plugins-off.png), [ответ по дайджесту](docs/screenshots/hw2-mem04-digest-answer.png)                                                                                                                                                                                                 |
| 3. Быстрые команды и auto hooks            | [`.claude/skills/lib-*`](.claude/skills/), hooks [`session-start.ts`](.claude/hooks/session-start.ts), [`pre-compact.ts`](.claude/hooks/pre-compact.ts), регистрация — [`.claude/settings.json`](.claude/settings.json)                                                                                                       | `/lib-status`, `/lib-check`, `/hooks`; `npx vitest run tests/unit/session-start.test.ts tests/unit/pre-compact.test.ts tests/unit/lib-skills.test.ts tests/unit/format-and-lint.test.ts`     | [`/lib-status`](docs/screenshots/hw2-hook01-status.png), [`/lib-check`](docs/screenshots/hw2-hook01-check.png), [`/lib-handoff`](docs/screenshots/hw2-hook01-handoff.png), [`/lib-commit`](docs/screenshots/hw2-hook01-commit.png), [`/hooks`](docs/screenshots/hw2-hook02-hooks-menu.png), [дайджест](docs/screenshots/hw2-hook02-session-answer.png), [чек-пойнт](docs/screenshots/hw2-hook03-compact.png)                                                     |
| 4. Управление контекстом, usage до и после | `autoCompactWindow: 200000` в [`.claude/settings.json`](.claude/settings.json), чек-пойнт `PreCompact` → `SessionStart(compact)`, statusline и монитор GSD, политика — раздел «Контекст» в [`AGENTS.md`](AGENTS.md), замеры — [`docs/context-usage.md`](docs/context-usage.md)                                                | `/context` (строка «Auto-compact window: 200k tokens»); `npx vitest run tests/unit/settings-permissions.test.ts -t "auto-compact window"`                                                    | usage [до](docs/screenshots/hw2-usage-before.png) / [после](docs/screenshots/hw2-usage-after.png); `/context` [до](docs/screenshots/hw2-context-before-progress.png) / [после](docs/screenshots/hw2-context-after-progress.png); [сжатие вручную](docs/screenshots/hw2-ctx02-manual.png), [автосжатие](docs/screenshots/hw2-ctx02-auto.png), [statusline](docs/screenshots/hw2-ctx03-statusline.png), [WARNING монитора](docs/screenshots/hw2-ctx03-warning.png) |
| 5. Discovery в GSD                         | [`renewal-and-fines.md`](.planning/notes/renewal-and-fines.md) (`/gsd-explore`), [`04-SPEC.md`](.planning/phases/04-discovery-prodlenie-i-peni/04-SPEC.md), [`04-CONTEXT.md`](.planning/phases/04-discovery-prodlenie-i-peni/04-CONTEXT.md)                                                                                   | `git diff --stat ca429d0 -- src tests` — пусто: Discovery код не менял                                                                                                                       | [пустой diff и артефакты](docs/screenshots/hw2-disc01-diff.png)                                                                                                                                                                                                                                                                                                                                                                                                  |

**Как читать скриншоты usage.** `/usage` показывает расход лимитов подписки, накопленный к моменту
снимка (сессия 55% → 22%, неделя 19% → 48%), а не цену сценария, поэтому «до» и «после» напрямую не
сравниваются. Эффект управления контекстом виден на снимках `/context` одного сценария: старт
36.8k → 37.4k, после `/gsd-progress` — 9% окна 1M → 47% окна 200k, то есть порог автосжатия теперь
достижим и отслеживается statusline. Сценарий и разбор — в [`docs/context-usage.md`](docs/context-usage.md).

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

## Модуль 3: продуктовая аналитика и визуальная концепция

Задание — [`docs/homework-3.md`](docs/homework-3.md). Работа сделана в ветке `feat/design-md`. Результат — материалы
для изменения интерфейса и план его выполнения. **Код в этом ДЗ не менялся:** `src/client` остался прежним,
`/gsd-execute-phase` не запускался. Входная точка для агента — [`docs/handoff/context.md`](docs/handoff/context.md).

Команды вида `/…` вводятся в сессии Claude Code, остальные — в терминале из корня проекта.

| Пункт ДЗ                                  | Артефакты                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Команда проверки                                                               | Скриншоты                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Аналоги: фичи, UX, UI                  | [`competitors.md`](docs/research/competitors.md): Libib, Koha, Evergreen, что берём и что нет                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | —                                                                              | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2. Полный контекст для агента             | [`context.md`](docs/handoff/context.md), [`prd.md`](docs/handoff/prd.md), [`prd-review.md`](docs/handoff/prd-review.md) (критика PRD и реализуемость), [`user-stories.md`](docs/handoff/user-stories.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | —                                                                              | интерфейс до изменений: [основной](docs/screenshots/hw3-before-main.png), [отказ](docs/screenshots/hw3-before-error-limit.png), [сбой API](docs/screenshots/hw3-before-api-down.png), [пусто](docs/screenshots/hw3-before-empty.png), [телефон](docs/screenshots/hw3-before-mobile.png)                                                                                                                                                                                                    |
| 3. `gsd-discuss-phase` и `gsd-plan-phase` | [`06-CONTEXT.md`](.planning/phases/06-produktovaya-analitika-i-vizualnaya-kontseptsiya/06-CONTEXT.md), [`06-DISCUSSION-LOG.md`](.planning/phases/06-produktovaya-analitika-i-vizualnaya-kontseptsiya/06-DISCUSSION-LOG.md), [`06-PATTERNS.md`](.planning/phases/06-produktovaya-analitika-i-vizualnaya-kontseptsiya/06-PATTERNS.md), планы [`06-01`](.planning/phases/06-produktovaya-analitika-i-vizualnaya-kontseptsiya/06-01-PLAN.md), [`06-02`](.planning/phases/06-produktovaya-analitika-i-vizualnaya-kontseptsiya/06-02-PLAN.md), [`06-03`](.planning/phases/06-produktovaya-analitika-i-vizualnaya-kontseptsiya/06-03-PLAN.md), [`06-04`](.planning/phases/06-produktovaya-analitika-i-vizualnaya-kontseptsiya/06-04-PLAN.md) | `git diff --stat main -- src tests package.json package-lock.json` — пусто     | discuss-phase: [часть 1](docs/screenshots/hw3-discuss-phase-1.png), [часть 2](docs/screenshots/hw3-discuss-phase-2.png)                                                                                                                                                                                                                                                                                                                                                                    |
| 4. UX-паттерны: экраны, переходы          | [`ux-patterns.md`](docs/handoff/ux-patterns.md), макет [`main-screen.html`](docs/mockups/main-screen.html)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | открыть макет в браузере; состояния переключаются адресом, например `#refusal` | макет: [рабочий вид](docs/screenshots/hw3-mockup-work.png), [первый запуск](docs/screenshots/hw3-mockup-first.png), [ожидание](docs/screenshots/hw3-mockup-waiting.png), [выдано](docs/screenshots/hw3-mockup-issued.png), [возврат](docs/screenshots/hw3-mockup-returned.png), [сохранено](docs/screenshots/hw3-mockup-saved.png), [отказ](docs/screenshots/hw3-mockup-refusal.png), [сбой](docs/screenshots/hw3-mockup-failed.png), [390 px](docs/screenshots/hw3-mockup-narrow-390.png) |
| 5. Цвета для UI                           | [`DESIGN.md`](DESIGN.md): роли цветов, контраст, типографика, отступы, компоненты, состояния                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | —                                                                              | те же снимки макета                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

**Что изменилось после обсуждения.** На снимках discuss-phase выбрано настроение «Тёплый библиотечный». Позже автор
заменил палитру на [свою из Coolors](https://coolors.co/a8d5e2-f9a620-ffd449-548c2f-104911), поэтому действующее решение —
D-06 в `06-CONTEXT.md` и `DESIGN.md`. Контраст пересчитан под новую палитру.

**Что не подтверждено:**

- Спрос на продукт: пользователей и интервью нет.
- Текущий вид Libib, Koha и Evergreen: UI оценён по снимкам из документации, живые экраны не открывались.
- Дубль при двойном клике (FR-3): риск виден по коду, но не воспроизведён. Падающий тест стоит в задаче 3 плана `06-01`:
  если он не упадёт, выполнение останавливается.
- Сами планы не выполнялись, снимков «после» нет: вместо них показан статичный макет. После ручных правок
  по итогам второй проверки планы прошли только автоматические проверки структуры и покрытия решений.

## Модуль 4: быстрое прототипирование и MVP

Задание — [`docs/homework-4.md`](docs/homework-4.md). Работа сделана в ветке `feat/mvp-prototype` как
[фаза 7](.planning/phases/07-bystroe-prototipirovanie-i-sborka-mvp/): решения D-01…D-16 — в
[`07-CONTEXT.md`](.planning/phases/07-bystroe-prototipirovanie-i-sborka-mvp/07-CONTEXT.md), 10 планов с отчётами
`07-NN-SUMMARY.md`. Домен, API и формат `data/library.json` не менялись. Рядом работают три варианта интерфейса,
между ними переключают ссылки в подвале:

- `/` — прежний интерфейс, «до»; заморожен, добавлены только ссылки на варианты (D-01, D-03);
- `/prototype/` — кликабельный прототип на демо-данных в памяти браузера, без сервера, восемь состояний макета (D-10);
- `/v2/` — MVP на тех же компонентах и настоящем API (D-11).

Запуск: `npm run dev`, затем `http://localhost:5173/v2/` и `http://localhost:5173/prototype/`. В Docker:
`docker compose up --build -d`, затем `http://localhost:8080` (nginx отдаёт статику и проксирует `/api` в Node,
данные на томе, пустой том получает [`data/seed.json`](data/seed.json), D-14).

Публичные ссылки (собственный VPS у [Play2Go](https://play2go.cloud/), HTTPS):

- MVP: https://otus-ai.silentharbor.ru/v2/
- Прототип: https://otus-ai.silentharbor.ru/prototype/
- Прежний интерфейс: https://otus-ai.silentharbor.ru/

| Пункт ДЗ    | Артефакты                                                                                                                                                                                                                                              | Команда проверки                                                                                                                                                                                                                                                                     | Скриншоты                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Ссылка                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1. UX, UI   | [`DESIGN.md`](DESIGN.md): разделы «Соответствие токенам shadcn/ui», «Форма и глубина» (исключение про анимации, D-07), «История изменений»; [`ux-patterns.md`](docs/handoff/ux-patterns.md), макет [`main-screen.html`](docs/mockups/main-screen.html) | `npx vitest run tests/unit/css-tokens.test.ts` — цвета и отступы `/v2/` и `/prototype/` только из токенов `DESIGN.md`                                                                                                                                                                | [рабочий вид `/v2/`](docs/screenshots/hw4-v2-work.png), [375 px](docs/screenshots/hw4-v2-narrow-375.png)                                                                                                                                                                                                                                                                                                                                                       | —                                                           |
| 2. Прототип | [`src/client-v2/prototype/`](src/client-v2/prototype/) (сценарии по хешу адреса), [`src/client-v2/demo/`](src/client-v2/demo/) (адаптер API в памяти, вызывает функции `src/domain`)                                                                   | `npx playwright test tests/e2e/prototype.spec.ts`                                                                                                                                                                                                                                    | [работа](docs/screenshots/hw4-prototype-work.png), [первый запуск](docs/screenshots/hw4-prototype-first.png), [сбой](docs/screenshots/hw4-prototype-failed.png), [ожидание](docs/screenshots/hw4-prototype-waiting.png), [сохранено без списка](docs/screenshots/hw4-prototype-saved.png), [выдано](docs/screenshots/hw4-prototype-issued.png), [отказ](docs/screenshots/hw4-prototype-refusal.png), [возвращено](docs/screenshots/hw4-prototype-returned.png) | [прототип](https://otus-ai.silentharbor.ru/prototype/)      |
| 3. MVP      | [`src/client-v2/`](src/client-v2/): `App.tsx`, `features/`, компоненты shadcn в `components/ui/`; библиотеки — ниже                                                                                                                                    | `npx playwright test tests/e2e/v2-shell.spec.ts tests/e2e/v2-outcome.spec.ts tests/e2e/v2-lock.spec.ts tests/e2e/v2-lists.spec.ts tests/e2e/v2-hints.spec.ts tests/e2e/v2-layout.spec.ts tests/e2e/v2-motion.spec.ts tests/e2e/v2-main-flow.spec.ts tests/e2e/variant-links.spec.ts` | [рабочий вид](docs/screenshots/hw4-v2-work.png), [выдано](docs/screenshots/hw4-v2-issued.png), [отказ](docs/screenshots/hw4-v2-refusal.png), [375 px](docs/screenshots/hw4-v2-narrow-375.png), [ссылки на `/`](docs/screenshots/hw4-old-links.png)                                                                                                                                                                                                             | [MVP](https://otus-ai.silentharbor.ru/v2/)                  |
| 4. Хостинг  | [`Dockerfile`](Dockerfile), [`docker-compose.yml`](docker-compose.yml), [`docker/nginx.conf`](docker/nginx.conf), [`data/seed.json`](data/seed.json); собственный VPS с Docker Compose и Caddy (HTTPS, `reverse_proxy` на `127.0.0.1:8080`)            | `E2E_BASE_URL=https://otus-ai.silentharbor.ru E2E_REAL_FONT=1 npx playwright test -c playwright.docker.config.ts tests/e2e/release-checklist.spec.ts` — чек-лист перед показом (D-13), 5 passed                                                                                      | [`/v2/` на 375 px](docs/screenshots/hw4-public-v2-375.png), [`/prototype/`](docs/screenshots/hw4-public-prototype.png)                                                                                                                                                                                                                                                                                                                                         | [otus-ai.silentharbor.ru](https://otus-ai.silentharbor.ru/) |

Чек-лист перед показом (D-13) — [`release-checklist.spec.ts`](tests/e2e/release-checklist.spec.ts): каждый тест в новом
контексте браузера (аналог окна инкогнито), заголовок вкладки, консоль без ошибок, ни одного ответа с кодом 400 и выше,
375 px без горизонтальной прокрутки на `/v2/` и `/prototype/`. С `E2E_REAL_FONT=1` настоящий шрифт IBM Plex Sans
грузится из Google Fonts и тоже проверяется. На публичном адресе 2026-11-16: 5 passed. Адреса без косой черты
(`/v2`, `/prototype`) отвечают 301 на адрес с косой чертой, `http://` — 308 на `https://`.

### Библиотеки с урока

Взяты:

- **Tailwind CSS 4** (4.3.5, плагин `@tailwindcss/vite`): все стили `/v2/` и `/prototype/`, токены `DESIGN.md` в
  `@theme` файла [`src/client-v2/styles.css`](src/client-v2/styles.css).
- **shadcn/ui** (пресет `radix-nova` на Radix): компоненты `button`, `input`, `label`, `card`, `table`, `alert`,
  `native-select` в `src/client-v2/components/ui/`, переписаны без теней и цветов вне токенов. Список выбора —
  нативный `<select>`; для подтверждений своя обёртка с `role="status"` (D-12).
- **lucide-react**: единственный набор иконок (стрелка списка выбора в `native-select`).
- **Motion** (14.14.0): вход сообщения, новой строки выдачи и таблицы после пустого текста, 150–300 мс, при
  `prefers-reduced-motion` без движения (D-07).
- **21st.dev**: только просмотрены образцы Table, Empty State и Alert (`DESIGN.md`, «Откуда взято»); код не взят —
  компоненты сделаны на shadcn/ui.

Не взяты (D-06):

- **TailArk** — набор секций лендинга, а лендинг не делаем.
- **GSAP** — анимации закрывает Motion (D-05, D-07), второй движок анимаций не нужен.
- **Design OS** — видение, сущности, токены и экраны уже есть после ДЗ-3 (`docs/handoff/`, `DESIGN.md`, макет).
- **UI/UX Pro Max** — направление, палитра и шрифт уже выбраны автором в ДЗ-3.

### Принятый риск

- **Собственный VPS вместо Vercel или TimeWeb Cloud.** Пункт 4 называет эти площадки; приложение размещено на собственном
  VPS у провайдера [Play2Go](https://play2go.cloud/) (Ubuntu, Docker Compose, Caddy с HTTPS). Причина: MVP пишет данные в файл на томе (D-14), ему нужен сервер с
  постоянным диском, а статический хостинг для `/v2/` не подходит; выбор площадки оставлен автору (D-15). Один домен
  для трёх страниц — ссылки между вариантами работают без `VITE_APP_ORIGIN`. Порт `web` опубликован только на
  `127.0.0.1` хоста: Docker обходит ufw, снаружи открыт только HTTPS через Caddy.
- **Запись без входа.** Публичное демо принимает изменения от любого посетителя (ASVS V4 вне учебного объёма). Данные
  только демо (`Демо-…`, `@example.test`); сброс — `docker compose down -v` и запуск: пустой том снова получает seed.

### Что не подтверждено

- Настоящие телефоны: ширина 375 px проверена только эмуляцией в Chromium.
- Другие браузеры: e2e и чек-лист идут только в Chromium.
- Vercel и TimeWeb Cloud: не использовались, сборка на них не проверялась.
- Сброс тома на сервере (`docker compose down -v`): выполнялся ли он на VPS, автор не сообщал.

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
src/client/   React UI, прежний вариант на /
src/client-v2/
              прототип и MVP: компоненты shadcn, Tailwind, демо-адаптер (demo/), сценарии прототипа
v2/           страница Vite для /v2/; prototype/ — для /prototype/
tests/unit/   Vitest; tests/e2e/ — Playwright
docker/       nginx.conf; вместе с Dockerfile и docker-compose.yml — сборка и запуск в контейнерах
data/         seed.json — демо-данные для пустого тома
docs/         about.md (отчёт ДЗ-1), architecture.md (среда агента), memory.md (журнал),
              context-usage.md, security-checklist.md, screenshots/,
              handoff/ (PRD, истории, UX), research/ (аналоги), mockups/ (макет)
DESIGN.md     визуальная система: цвета, типографика, компоненты
.planning/    GSD: ROADMAP, REQUIREMENTS, STATE, фазы, карта кода
.claude/      rules, skills, agents, hooks, settings.json
.mcp.json     Playwright MCP для проверки UI агентом
```
