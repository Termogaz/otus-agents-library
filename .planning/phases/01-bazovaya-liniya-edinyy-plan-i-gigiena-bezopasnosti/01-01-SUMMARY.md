---
phase: 01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti
plan: 01
subsystem: docs
tags: [gsd, planning, claude-md, agents-md, review-step]

requires: []
provides:
  - ".planning/ — единственный источник плана и прогресса вехи ДЗ-2"
  - "CLAUDE.md импортирует @.planning/STATE.md в каждую сессию"
  - "docs/plan.md — указатель на .planning/ и неизменная история ДЗ-1"
  - "roadmap будущих модулей в .planning/PROJECT.md (Out of Scope)"
affects: [01-02, 01-03, 01-04, 01-05, phase-02, phase-05]

actuals:
  tokens: 2500
  tasks: 2
  commits: 3
plan_head_before: 588be48a31e4ead1838e3df0ef56865afbcd569e
plan_head_after: 12c5eceb5a15bba934d11ea365e888b70c0220a5

tech-stack:
  added: []
  patterns:
    - "Позиция GSD (.planning/STATE.md) импортируется в контекст сессии через CLAUDE.md"

key-files:
  created: []
  modified:
    - CLAUDE.md
    - AGENTS.md
    - .claude/skills/review-step/SKILL.md
    - docs/plan.md
    - .planning/PROJECT.md
    - .prettierignore

key-decisions:
  - "D-02: CLAUDE.md импортирует @.planning/STATE.md вместо @docs/plan.md"
  - "D-03: AGENTS.md строки 9 и 72 ведут план и прогресс в .planning/, дублировать галочки в docs/plan.md не нужно"
  - "D-04: roadmap будущих модулей перенесён из docs/plan.md в Out of Scope в .planning/PROJECT.md"

requirements-completed: [PLAN-01, PLAN-02]

coverage:
  - id: D1
    description: "CLAUDE.md импортирует @.planning/STATE.md, @docs/plan.md убран, .claude/CLAUDE.md не создан"
    requirement: PLAN-02
    verification:
      - kind: other
        ref: "grep -c -x -F '@.planning/STATE.md' CLAUDE.md; test ! -e .claude/CLAUDE.md"
        status: pass
    human_judgment: false
  - id: D2
    description: "AGENTS.md строки 9 и 72 и пункт 11 review-step ведут план и прогресс в .planning/; остальные строки AGENTS.md не изменены"
    requirement: PLAN-02
    verification:
      - kind: other
        ref: "git diff --numstat d399063 -- AGENTS.md => 2 2; negative grep по 'прогресс в docs/plan'"
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/plan.md: раздел ДЗ-1 побайтно прежний (md5), раздел «Модуль 2» и Roadmap заменены ссылками, незакрытых чекбоксов нет"
    requirement: PLAN-02
    verification:
      - kind: other
        ref: "md5 части до «## Модуль 2» против git show d399063:docs/plan.md; grep -c '^ *- \\[ \\]' docs/plan.md => 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "Шесть пунктов roadmap будущих модулей перенесены в Out of Scope в .planning/PROJECT.md"
    requirement: PLAN-02
    verification:
      - kind: other
        ref: "grep -F LIBRARY_DATA_FILE / 'Open Library' / 'блокировка должников' / 'деплой' .planning/PROJECT.md"
        status: pass
    human_judgment: false
  - id: D5
    description: "gsd-tools query progress возвращает веху v1.0 и фазу 01 (данные /gsd-progress)"
    requirement: PLAN-01
    verification:
      - kind: other
        ref: "node .claude/gsd-core/bin/gsd-tools.cjs query progress --pick milestone_version => v1.0; --pick 'phases[0].number' => 01"
        status: pass
    human_judgment: true
    rationale: "Слэш-команда /gsd-progress в интерфейсе Claude Code проверяется человеком в конце фазы (план 01-03); здесь подтверждены только её данные"

duration: 2 min
completed: 2026-10-25
status: complete
---

# Phase 1 Plan 01: Единый источник плана Summary

**`.planning/` стал единственным источником плана вехи ДЗ-2: CLAUDE.md импортирует `@.planning/STATE.md`, AGENTS.md и review-step ведут прогресс в GSD, а `docs/plan.md` превращён в указатель с нетронутой историей ДЗ-1**

## Performance

- **Duration:** 2 min
- **Started:** 2026-10-25T09:13:37Z
- **Completed:** 2026-10-25T09:15:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Новая сессия Claude Code получает позицию вехи из `.planning/STATE.md` (D-02); `.claude/CLAUDE.md` от GSD не создаётся.
- `AGENTS.md` строки 9 и 72 и пункт 11 skill `review-step` больше не требуют отмечать прогресс в `docs/plan.md` (D-03). Diff `AGENTS.md` относительно `d399063` — ровно `2 2`: запреты, процесс и команды дословно прежние.
- `docs/plan.md`: разделы ДЗ-1 побайтно прежние (md5 совпал с `d399063`), тело разделов «Модуль 2» и «Roadmap» заменено ссылками на `../.planning/ROADMAP.md`, `../.planning/STATE.md`, `../.planning/PROJECT.md`; незакрытых чекбоксов нет (D-01, D-04).
- Шесть пунктов roadmap будущих модулей перенесены в `### Out of Scope` файла `.planning/PROJECT.md` в формате «Что — причина», чтобы их видел `/gsd-new-milestone`.
- PLAN-01: `gsd-tools query progress` возвращает `v1.0` и фазу `01`.

## Task Commits

1. **Задача 1 (трассер): CLAUDE.md, AGENTS.md, review-step ведут в .planning/** - `ac3c1e7` (docs)
2. **Задача 2: docs/plan.md — указатель, roadmap в PROJECT.md** - `f217d47` (docs)
3. **Отклонение Rule 3: `.gsd/` в .prettierignore** - `12c5ece` (chore)

**Plan metadata:** пропущен (`commit_docs: false`, `skipped_commit_docs_false`); `.planning/` коммитит оркестратор вручную.

## Files Created/Modified

- `CLAUDE.md` - вместо `@docs/plan.md` импорт `@.planning/STATE.md`
- `AGENTS.md` - строки 9 и 72: план и прогресс — в `.planning/`, `docs/plan.md` — указатель и история ДЗ-1
- `.claude/skills/review-step/SKILL.md` - пункт 11 «План» сверяет позицию в `.planning/`
- `docs/plan.md` - «Модуль 2» и «Roadmap» заменены ссылками
- `.planning/PROJECT.md` - шесть пунктов roadmap в Out of Scope
- `.prettierignore` - добавлен `.gsd/`

## Decisions Made

- Решения D-02, D-03, D-04 исполнены как записано в `01-CONTEXT.md`; правки `AGENTS.md` и `CLAUDE.md` согласованы автором (D-03).
- Исследование `.planning/research/SUMMARY.md` советовало не импортировать STATE.md; действует решение автора D-02.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prettier падал на служебном файле GSD `.gsd/dispatch-isolation-sentinel.json`**

- **Found during:** итоговая проверка `npm run check` (после Задачи 2)
- **Issue:** оркестратор GSD создал `.gsd/dispatch-isolation-sentinel.json` (каталог в `.gitignore`, но не в `.prettierignore`); `prettier --check .` выдавал `Code style issues found`, `npm run check` был красным не из-за правок плана.
- **Fix:** строка `.gsd/` в `.prettierignore` рядом с остальными файлами GSD (тот же приём, что для `.claude/gsd-*`).
- **Files modified:** `.prettierignore`
- **Verification:** `env -u http_proxy ... npm run check` — typecheck, lint, format:check, 130 тестов зелёные.
- **Committed in:** `12c5ece`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** конфиг линтера и tsconfig не тронуты; игнорируется только рабочее состояние сторонней утилиты. Объём плана не расширен.

## Issues Encountered

- Первая попытка правки `docs/plan.md` не применилась из-за опечатки в моём `old_string`; файл не менялся, правка повторена корректно.

## Tracer Gate

Задача 1 была `type="tracer"`; режим `end-of-phase`, `<verify>` только `<automated>` — цепочка перепрогнана и прошла, расширение (Задача 2) выполнено без чекпоинта.

## Known Stubs

None.

## Threat Flags

None. Ограничения плана выдержаны: T-01-01 — diff `AGENTS.md` = `2 2`; T-01-02 — negative grep чист; пакеты не устанавливались, `package-lock.json` не тронут.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Готово к плану 01-02. Слэш-команда `/gsd-progress` и итоговый `grep` по упоминаниям `docs/plan.md` проверяются в плане 01-03.
- README строки 34 и 49 по-прежнему ссылаются на `docs/plan.md` как на историю ДЗ-1 (осознанно вне плана; обновляется в фазе 5, DOC-01).
- Незакоммиченные изменения `.planning/STATE.md`, `.planning/config.json`, `.planning/milestone.lock`, `.planning/state.json` — рабочее состояние GSD, коммитит оркестратор.

## Self-Check: PASSED

- FOUND: CLAUDE.md, AGENTS.md, .claude/skills/review-step/SKILL.md, docs/plan.md, .planning/PROJECT.md, .prettierignore
- FOUND: ac3c1e7, f217d47, 12c5ece (в истории ветки feat/module-2)
- Acceptance criteria обеих задач и `npm run check` повторно пройдены.

---
*Phase: 01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti*
*Completed: 2026-10-25*
