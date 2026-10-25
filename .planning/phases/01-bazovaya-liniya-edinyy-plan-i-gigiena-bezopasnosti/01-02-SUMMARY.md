---
phase: 01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti
plan: 02
subsystem: security
tags: [hooks, protect-files, reviewer-readonly, secret-names, tdd, vitest]

requires: []
provides:
  - ".claude/hooks/lib/secret-names.ts — единое определение секретных имён (isSecretPath и др.)"
  - "protect-files отклоняет чтение секретных .env* через аргументы Bash (cat/grep/less/head/tail/source/cp)"
  - "шаблон grep/egrep/fgrep/rg не считается путём; значение -f/--file проверяется как файл"
  - "reviewer-readonly не читает секреты через cat/head/tail/wc той же isSecretPath"
affects: [01-03, 01-04, 01-05, phase-02]

actuals:
  tokens: 9000
  tasks: 2
  commits: 4
plan_head_before: 12c5eceb5a15bba934d11ea365e888b70c0220a5
plan_head_after: 30177b655fcc3c41a19ba9a2f46372c8fa736a79

tech-stack:
  added: []
  patterns:
    - "Один модуль предикатов секретных имён на два hook'а (protect-files, reviewer-readonly)"
    - "Проверка аргумента-пути, а не подстроки команды; обратные слеши в isSecretPath не нормализуются"
    - "Процессный тест настоящего hook'а: spawnSync node_modules/.bin/tsx + JSON на stdin"

key-files:
  created:
    - .claude/hooks/lib/secret-names.ts
    - tests/unit/secret-names.test.ts
  modified:
    - .claude/hooks/protect-files.ts
    - .claude/hooks/reviewer-readonly.ts
    - tests/unit/protect-files.test.ts
    - tests/unit/reviewer-readonly.test.ts

key-decisions:
  - "D-05: проверяются аргументы-пути; у grep-семейства шаблон (первый позиционный без -e/-f, значения -e/--regexp) путём не считается"
  - "D-07: reviewer-readonly и protect-files используют одну функцию isSecretPath"
  - "D-08: секретное имя — .env* кроме .env.example/.env.sample/.env.template; для записи защищены все .env*"
  - "checkBashCommand сохранён как обёртка над checkBashDecision (тип BashDecision уже содержит 'ask' для плана 01-05)"

requirements-completed: [SEC-02]

coverage:
  - id: D1
    description: "Bash-команда с аргументом-путём секретного .env* отклоняется hook'ом protect-files (код 2); шаблоны .env.example/.env.sample/.env.template и шаблоны grep с .env проходят"
    requirement: SEC-02
    verification:
      - kind: unit
        ref: "tests/unit/protect-files.test.ts#blocks reading secret file / allows reading non-secret file / allows grep pattern that mentions env"
        status: pass
      - kind: integration
        ref: "tests/unit/protect-files.test.ts#hook process denies reading secret file with exit code 2"
        status: pass
    human_judgment: false
  - id: D2
    description: "Единый модуль secret-names.ts: ENV_TEMPLATES (3 имени), isEnvFileName, isSecretFileName, isSecretPath без нормализации обратных слешей"
    requirement: SEC-02
    verification:
      - kind: unit
        ref: "tests/unit/secret-names.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "subagent reviewer не читает секреты через cat/head/tail/wc (относительный, ../ и абсолютный путь)"
    requirement: SEC-02
    verification:
      - kind: unit
        ref: "tests/unit/reviewer-readonly.test.ts#blocks reading secret file"
        status: pass
    human_judgment: false
  - id: D4
    description: "Живая проверка в сессии: отказ cat ./.env у основного агента и у reviewer (в т.ч. Grep по секрету) — собрана в end-of-phase human-check плана 01-03"
    requirement: SEC-02
    verification: []
    human_judgment: true
    rationale: "Поведение живой сессии Claude Code (подключение hook'ов, инструменты Read/Grep у reviewer) юнит-тестами не воспроизводится; проверка запланирована в 01-03"

duration: 2min
completed: 2026-10-25
status: complete
---

# Phase 1 Plan 02: Чтение секретов через Bash и reviewer Summary

**Hook protect-files отклоняет чтение секретных .env* через аргументы-пути Bash (шаблон grep — не путь), reviewer-readonly проверяет операнды той же isSecretPath из нового модуля secret-names.ts; всё закреплено 137 тестами на три файла и процессным тестом настоящего hook'а.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-10-25T09:17:02Z
- **Completed:** 2026-10-25T09:19:34Z
- **Tasks:** 2
- **Files modified:** 6 (2 созданы, 4 изменены)

## Accomplishments

- Модуль `.claude/hooks/lib/secret-names.ts`: `ENV_TEMPLATES`, `isEnvFileName` (запись: все `.env*`), `isSecretFileName` и `isSecretPath` (чтение: `.env*` кроме трёх шаблонов; хвост из скобок и кавычек — не имя файла).
- `checkBashDecision` в `protect-files.ts`: после проверок записи проверяет каждый аргумент-путь команды (кроме `ls`, `test`, `[`, `stat`); у `grep/egrep/fgrep/rg` шаблон пропускается, `-f/--file` проверяется как файл, поддержаны склеенные короткие флаги и `--file=`.
- Сквозной путь доказан: процессный тест `hook process denies reading secret file with exit code 2` запускает настоящий `node_modules/.bin/tsx .claude/hooks/protect-files.ts`.
- `reviewer-readonly.ts`: для `cat/head/tail/wc` отказ при секретном операнде; `ls` без проверки.

## Task Commits

TDD, у каждой задачи пара test/feat:

1. **Задача 1 (трассер): protect-files** — RED `8d507b3` (test), GREEN `5ae2ad4` (feat)
2. **Задача 2: reviewer-readonly** — RED `ab676c6` (test), GREEN `30177b6` (feat)

REFACTOR-коммитов нет: правок после GREEN не потребовалось.

**Plan metadata:** не коммитится (`commit_docs: false`, пропуск `skipped_commit_docs_false`; `.planning/` коммитит оркестратор).

## TDD Evidence

**RED (задача 1):** 17 из 73 тестов красные. 16 кейсов `blocks reading secret file: ...` упали на `expected null not to be null`, процессный тест — на `expected +0 to be 2`. `tests/unit/secret-names.test.ts` падал на импорте, потому что модуля ещё не было — это ожидаемо для нового файла. Семантическая оценка: целевые тесты protect-files выполнились и упали на утверждении о планируемом поведении, а не на синтаксисе или фикстуре. `gsd_run check tdd-red-evidence` не запускался (запись RED-evidence для `workflow.tdd_mode` не включена, RED проверен по выводу vitest).

**RED (задача 2):** 7 из 35 красные, ровно кейсы `blocks reading secret file: ...` на `expected null not to be null`; разрешающие кейсы зелёные.

**GREEN:** `npx vitest run` по трём файлам — 137/137; `npm run check` — зелёный (9 файлов, 204 теста).

## Smoke-проверка живых hooks (после правки каждого файла)

- `protect-files.ts`: вход `ls` — `exit=0`; вход `cat ./.env` — `exit=2`, stderr: «protect-files: команда отклонена — ./.env: чтение секретных файлов .env* запрещено (...)».
- `reviewer-readonly.ts`: вход `wc -l README.md` — `exit=0`; вход `wc -l ./.env` — `exit=2`.
- Сбоев «отказ на всё» не было: порядок «сначала модуль, потом импорт» и vitest сразу после правок сработали.

## Decisions Made

- Следовали плану: D-05, D-07, D-08 (см. `key-decisions`).
- Тип `BashDecision` уже включает `'ask'`, но `isMain` реагирует только на `deny` — `ask` начнёт выдавать план 01-05 (в нём же обработка в `isMain`).

## Deviations from Plan

None - plan executed exactly as written.

Замечание, не отклонение: промежуточная правка импорта в `protect-files.test.ts` на секунду дала ESLint-ошибку `no-unused-vars` от PostToolUse-hook'а до добавления кейсов, использующих импорт; следующей правкой закрыто, ничего не отключалось.

## Issues Encountered

None.

## Известные ограничения (записать в checklist / memory, план 01-03)

- Значение опции grep отдельным аргументом (`-A 3`, `-m 1`) сойдёт за шаблон, а следующий аргумент проверяется как путь: возможен лишний отказ, пропуск чтения невозможен (T-01-10, ловушка для `docs/memory.md`).
- Не раскрываются подстановки `$VAR`, `$(...)`, глобы вида `.e*`, интерпретаторы (`python -c`). Цели `<`, вложенный `bash -c`, `--опция=.env` закрывает план 01-05; Read/Grep у reviewer — правило `Read(**/.env*)` плана 01-04 и ручная проверка в 01-03.

## Known Stubs

None.

## Threat Flags

None - новых сетевых точек, путей аутентификации или доступа к файлам вне threat_model плана нет.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Готовы 01-03 (checklist ссылается на тесты `blocks reading secret file`, `allows grep pattern that mentions env`) и 01-05 (расширяет `checkBashDecision`, уже возвращает `BashDecision`).
- Блокеров нет.

## Self-Check: PASSED

- FOUND: .claude/hooks/lib/secret-names.ts, tests/unit/secret-names.test.ts
- FOUND коммиты: 8d507b3, 5ae2ad4, ab676c6, 30177b6 (все в HEAD)
- `npm run check` зелёный; `.claude/agents/` и `.claude/settings.local.json` не менялись; существующие тест-строки не удалены.

---
*Phase: 01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti*
*Completed: 2026-10-25*
