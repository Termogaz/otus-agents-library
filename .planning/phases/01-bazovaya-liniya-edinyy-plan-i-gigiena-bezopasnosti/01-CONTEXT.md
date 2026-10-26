# Phase 1: Базовая линия, единый план и гигиена безопасности - Context

**Gathered:** 2026-10-22
**Status:** Ready for planning

<domain>
## Phase Boundary

План вехи ДЗ-2 ведётся в одном месте (`.planning/`), а `docs/plan.md`, `AGENTS.md` и `CLAUDE.md`
указывают туда. До подключения памяти (фаза 2) закрыты известные обходы запретов: чтение `.env`
через Bash и `reviewer`, `git add -f` секрета, правка `.claude/**` агентом без подтверждения.
Появляется `docs/security-checklist.md`. Сама фаза проходит полный цикл GSD
(PLAN → выполнение → VERIFICATION).

Требования: PLAN-01, PLAN-02, PLAN-04, SEC-01, SEC-02, SEC-03.

Уже сделано до обсуждения:
- Критерий 1 (снимки `/context` и `/usage` «до» и сценарий) — коммит `b1fd263`,
  `docs/context-usage.md`, `docs/screenshots/hw2-*-before*.png`. Повторять не нужно.
- PLAN-01 по существу выполнен: `ROADMAP.md`, `REQUIREMENTS.md`, `STATE.md` есть; в фазе остаётся
  только подтвердить `/gsd-progress`.

Вне фазы: исправление остальных находок `CONCERNS.md` (API без авторизации, `0.0.0.0`, лимиты ввода,
fail-open hooks, коммит в `main`, `npx` в `.mcp.json`) — они попадают в чек-лист со статусом «открыт».
</domain>

<decisions>
## Implementation Decisions

### Единый план
- **D-01:** `docs/plan.md` сохраняет разделы ДЗ-1 как журнал сданного; раздел «Модуль 2» заменяется
  ссылкой на `.planning/ROADMAP.md` и `.planning/STATE.md`. Ссылки на `docs/plan.md` из README и
  `docs/about.md` не ломаются.
- **D-02:** `CLAUDE.md`: `@docs/plan.md` заменить на `@.planning/STATE.md` (короткий файл с позицией;
  полный ROADMAP агент читает по запросу). `.claude/CLAUDE.md` от GSD по-прежнему не генерируется.
- **D-03:** `AGENTS.md` строки 9 и 72: план и прогресс — в `.planning/` (`ROADMAP.md`, `STATE.md`),
  обновляются командами GSD; `docs/plan.md` — указатель и история ДЗ-1. Дублировать галочки в
  `docs/plan.md` не нужно. Правка `AGENTS.md` и `CLAUDE.md` согласована автором в этом обсуждении.
- **D-04:** Раздел «Roadmap (следующие модули)» из `docs/plan.md` переносится в
  `.planning/PROJECT.md` (будущие вехи / Out of Scope), чтобы его видел `/gsd-new-milestone`.
  В `docs/plan.md` вместо него — ссылка.

### Обходы чтения .env (SEC-02)
- **D-05:** Основной слой — закоммиченный hook `protect-files` (`.claude/hooks/protect-files.ts`,
  парсер `.claude/hooks/lib/shell.ts`): любая Bash-команда, у которой аргумент-путь имеет basename
  секретного файла, отклоняется (`cat ./.env`, `grep x .env`, `less .env`, `head`, `tail`, абсолютные и
  относительные пути). Проверяется аргумент-путь, а не подстрока: шаблон `'\.env'` в grep по другому
  файлу не должен блокироваться. Каждый обход и ложное срабатывание — тест Vitest в
  `tests/unit/protect-files.test.ts`.
- **D-06:** Второй слой — deny-шаблоны в `.claude/settings.json` (`Read(**/.env*)`, варианты
  `cat ./.env*` и т.п. в синтаксисе, который поддерживает установленная версия Claude Code).
- **D-07:** `reviewer-readonly.ts`: `cat`/`head`/`tail`/`wc` с аргументом — секретным файлом
  отклоняются; используется та же функция определения секретного имени, что в `protect-files`.
  Тест в `tests/unit/reviewer-readonly.test.ts`.
- **D-08:** Секретные имена: все `.env*` (включая `.env.local`, `.envrc`), кроме шаблонов
  `.env.example`, `.env.sample`, `.env.template` — их читать можно (как в `gsd-secret-read-guard`).
- **D-09:** `git add -f`/`--force` с путём `.env*` блокируется в том же hook; тест.
- **D-10:** `gsd-secret-read-guard` (в `.claude/settings.local.json`, вне git) остаётся как
  дополнительный локальный слой. В checklist и `docs/memory.md` записать: он не воспроизводится из git
  и даёт ложные срабатывания (блокирует `grep` с шаблоном `\.env` по чужому файлу).

### Защита .claude/ (SEC-03)
- **D-11:** `ask` на `Edit`/`Write` для всего `./.claude/**` (включая файлы GSD и
  `settings.local.json`) — одно правило в `.claude/settings.json`. Проверить, что `ask` действует
  при `defaultMode: acceptEdits`.
- **D-12:** Запись в `.claude/` через Bash (`sed -i`, `>`, `tee`, `cp` и т.п.) — `protect-files`
  возвращает решение `ask` (`permissionDecision: "ask"`), а не отказ; покрыто тестами.
  `.env*`, `.git/`, `package-lock.json` остаются отказом, как сейчас.

### Security-checklist (SEC-01)
- **D-13:** Охват 8–12 пунктов: среда агента (чтение `.env`, `git add -f`, правка `.claude/`,
  `git push`/коммит в `main`, fail-open hooks без `node_modules`, `npx -y` в `.mcp.json`,
  GSD-guard вне git, широкие allow в `settings.local.json` — SEC-04) плюс главное в API
  (нет авторизации, слушает `0.0.0.0`, нет лимитов длины ввода и `copies`).
- **D-14:** Формат — одна таблица: Риск | Где закрыт (файл) | Команда проверки | Статус
  (закрыт / открыт) | Воспроизводим из git (да / нет). Документ на русском.
- **D-15:** Команда проверки — тест Vitest, где возможно (`npx vitest run tests/unit/<file>.test.ts -t "<имя>"`);
  для permissions — ручной шаг в сессии Claude Code (например, попросить `cat ./.env`) или `grep` по
  `.claude/settings.json`.

### Claude's Discretion
- Точный синтаксис deny/ask-шаблонов — по документации установленной версии Claude Code.
- Как вынести определение секретного имени в общий модуль `.claude/hooks/lib/`.
- Разбиение фазы на планы и порядок задач (TDD для логики hooks — по `AGENTS.md`).
- Запись итога фазы в `docs/memory.md` и отметка шага 1в в `docs/plan.md`.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Правила и план
- `AGENTS.md` — правила проекта; строки 9 и 72 меняются (D-03); запреты (не ослаблять проверки, TDD)
- `CLAUDE.md` — импорт `@docs/plan.md` → `@.planning/STATE.md` (D-02)
- `docs/plan.md` — история ДЗ-1, раздел «Модуль 2» и «Roadmap» (D-01, D-04)
- `.planning/PROJECT.md` — Key Decisions, Out of Scope; сюда переносится roadmap будущих модулей
- `.planning/REQUIREMENTS.md` — PLAN-01/02/04, SEC-01/02/03, SEC-04 (v2)
- `.planning/ROADMAP.md` §Phase 1 — критерии успеха
- `docs/homework-2.md` — текст задания ДЗ-2

### Безопасность
- `.planning/codebase/CONCERNS.md` §Security Considerations, §Fragile Areas, §Test Coverage Gaps — вход для чек-листа и обходов
- `.claude/settings.json` — permissions и hooks (в git)
- `.claude/settings.local.json` — hooks GSD, включая `gsd-secret-read-guard` (вне git)
- `.claude/hooks/protect-files.ts`, `.claude/hooks/lib/shell.ts`, `.claude/hooks/lib/hook-input.ts`
- `.claude/hooks/reviewer-readonly.ts`, `.claude/agents/reviewer.md`
- `.claude/hooks/gsd-secret-read-guard.js` — образец списка исключений для шаблонов `.env`
- `docs/about.md` — описание запретов ДЗ-1 («эвристика, не песочница»)
- `docs/memory.md` — ловушки hooks (fail-open при ошибке запуска, парсер не раскрывает `$VAR`)

### Снимки «до»
- `docs/context-usage.md` — сценарий снимков; `docs/screenshots/hw2-*-before*.png`
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `parseShell` (`.claude/hooks/lib/shell.ts`): разбивает команду на сегменты и слова — основа проверки аргументов-путей.
- `protectedReason` в `protect-files.ts`: уже матчит basename `.env*` для записи — расширить на чтение и исключения шаблонов.
- `exitWithFeedback`, `readHookInput`, `isMain` (`.claude/hooks/lib/hook-input.ts`): общий каркас hook'ов; для `ask` понадобится вывод JSON с `permissionDecision`.

### Established Patterns
- Логика hook'а — экспортируемая чистая функция + тонкий `isMain`-запуск; тесты вызывают функцию напрямую (`tests/unit/protect-files.test.ts`, `reviewer-readonly.test.ts`).
- Hooks запускаются через `node_modules/.bin/tsx`; при ошибке запуска — fail-open (известная ловушка).
- `.planning/` вне Prettier; `commit_docs: false` — коммиты вручную, сообщения на русском.

### Integration Points
- `.claude/settings.json` → `permissions.ask` / `deny`, `hooks.PreToolUse` (`Edit|Write|Bash`).
- frontmatter `.claude/agents/reviewer.md` → `reviewer-readonly.ts`.
</code_context>

<specifics>
## Specific Ideas

- Наблюдение из сессии обсуждения: `gsd-secret-read-guard` заблокировал `grep -n -i "...\.env..." .planning/research/SUMMARY.md` — пример ложного срабатывания для чек-листа (D-10) и тест «шаблон в grep — не чтение секрета» для нашего hook'а (D-05).
</specifics>

<deferred>
## Deferred Ideas

- Hook, запрещающий `git commit` на ветке `main` — в чек-лист как «открыт».
- Проверка наличия `node_modules` при старте сессии (fail-open hooks) — кандидат для `SessionStart` в фазе 2.
- Сузить `settings.local.json` (SEC-04) — v2.
- API: привязка к `127.0.0.1`, лимиты длины ввода, авторизация — бэклог приложения.
</deferred>

---

*Phase: 01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti*
*Context gathered: 2026-10-22*
