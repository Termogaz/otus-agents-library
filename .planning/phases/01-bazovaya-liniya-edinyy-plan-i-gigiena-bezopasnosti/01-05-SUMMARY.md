---
phase: 01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti
plan: 05
subsystem: security
tags: [hooks, protect-files, shell-parser, git-add-force, permission-ask, tdd, vitest]

requires:
  - phase: 01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti
    provides: "01-02: secret-names.ts, checkBashDecision/BashDecision (уже с 'ask'), правило операндов grep-семейства"
provides:
  - "protect-files отклоняет чтение .env* через цель < , вложенный shell (sh/bash/zsh/dash -c, -lc) и значение --опция=путь"
  - "git add -f/--force с .env*, широким pathspec или -A — отказ"
  - "запись в .claude/ через Bash даёт решение ask (JSON, код 0); отказы по секретам приоритетнее"
  - "ShellSegment.readTargets и оператор << в shell.ts; exitWithAsk в hook-input.ts"
affects: [01-03, phase-02]

actuals:
  tokens: 17000
  tasks: 2
  commits: 4
plan_head_before: 61e183923572e07298968aa4517fe842db2445bb
plan_head_after: f4e69b8e9909e23f0d1eea6d107695708453286d

tech-stack:
  added: []
  patterns:
    - "checkBashDecision = checkCommand (рекурсия по вложенному shell) + checkSegment; итог: любой deny побеждает, иначе первый ask"
    - "ask не прерывает проверку сегмента: ask ??= ..., deny по секрету из той же команды возвращается раньше"
    - "Решение ask для PreToolUse: одна строка JSON hookSpecificOutput в stdout и код 0"

key-files:
  created: []
  modified:
    - .claude/hooks/lib/shell.ts
    - .claude/hooks/lib/hook-input.ts
    - .claude/hooks/protect-files.ts
    - tests/unit/protect-files.test.ts

key-decisions:
  - "D-05: цель < хранится в readTargets; << и <<< (heredoc, here-string) — не файл; значение --опция=путь проверяется, --regexp= у grep-семейства — шаблон"
  - "D-09: git add с форсом — отказ при пути .env*, широком pathspec (., ./, префикс ':', оканчивается на /, содержит *), -A/--all или отсутствии путей"
  - "D-12: запись в .claude/ через Bash — ask, а не deny; deny по .env*, .git/, package-lock.json приоритетнее"
  - "Превышение глубины вложенного shell (больше 3) — deny (fail-closed), а не молчаливый пропуск"

requirements-completed: [SEC-02, SEC-03]

coverage:
  - id: D1
    description: "Чтение .env* через < , bash -c / sh -lc и --file=.env отклоняется hook'ом; heredoc, here-string и --regexp= проходят"
    requirement: SEC-02
    verification:
      - kind: unit
        ref: "tests/unit/protect-files.test.ts#checkBashCommand input and nested shell"
        status: pass
      - kind: integration
        ref: "tests/unit/protect-files.test.ts#hook process denies input redirect from secret file"
        status: pass
    human_judgment: false
  - id: D2
    description: "git add -f/--force с секретом или широким pathspec отклоняется; обычный git add проходит"
    requirement: SEC-02
    verification:
      - kind: unit
        ref: "tests/unit/protect-files.test.ts#blocks forced git add / allows ordinary git add"
        status: pass
    human_judgment: false
  - id: D3
    description: "Запись в .claude/ через Bash (sed -i, >, >>, tee, cp, rm, sh -c) даёт ask; deny приоритетнее; чтение .claude/ проходит; checkBashCommand для ask даёт null"
    requirement: SEC-03
    verification:
      - kind: unit
        ref: "tests/unit/protect-files.test.ts#asks before writing agent config / prefers deny over ask / does not ask for reading agent config"
        status: pass
      - kind: integration
        ref: "tests/unit/protect-files.test.ts#hook process asks before writing agent config"
        status: pass
    human_judgment: false
  - id: D4
    description: "Живой запрос подтверждения в сессии Claude Code на echo x >> .claude/hooks/tmp-check.ts"
    requirement: SEC-03
    verification: []
    human_judgment: true
    rationale: "Поведение живой сессии (показ запроса пользователю по JSON ask) юнит-тестами не воспроизводится; проверка в end-of-phase human-check плана 01-03"

duration: 5min
completed: 2026-10-25
status: complete
---

# Phase 1 Plan 05: Обходы чтения .env, git add -f и ask для .claude/ Summary

**protect-files теперь видит чтение .env через `<`, вложенный `bash -c` и `--file=.env`, отклоняет `git add -f` с секретом или широким pathspec и отвечает JSON `ask` на запись в `.claude/` через Bash; всё закреплено 29 новыми тестами, включая два процессных на настоящем бинаре tsx.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-10-25T09:24:35Z
- **Completed:** 2026-10-25T09:30:21Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `shell.ts`: поле `ShellSegment.readTargets` (цели `<`), оператор `<<` для heredoc и here-string; существующие кейсы heredoc и `tee -a package-lock.json < input` остались зелёными.
- `protect-files.ts`: `checkBashDecision` разделён на `checkCommand` (итог по команде, рекурсия по `sh/bash/zsh/dash -c`, глубина не больше 3) и `checkSegment`; проверяются `readTargets` и значения `--опция=путь`.
- Ветка `git add` с форсом (D-09) и решение `ask` для записи в `.claude/` (D-12); `isMain` вызывает `exitWithAsk` для ask.
- `hook-input.ts`: `exitWithAsk(reason): never` — JSON `hookSpecificOutput` в stdout, код 0.
- Процессные тесты запускают настоящий `node_modules/.bin/tsx .claude/hooks/protect-files.ts`: код 2 для `cat < .env`, JSON `ask` с кодом 0 для `sed -i ... .claude/settings.json`.

## Task Commits

TDD, у каждой задачи пара test/feat; REFACTOR-коммитов нет:

1. **Задача 1 (трассер): `< `, вложенный shell, `--опция=`** — RED `273c2d8` (test), GREEN `52f64c7` (feat)
2. **Задача 2: `git add -f` и ask для `.claude/`** — RED `a2a638b` (test), GREEN `f4e69b8` (feat)

**Plan metadata:** не коммитится (`commit_docs: false`, `skipped_commit_docs_false`; `.planning/` коммитит оркестратор).

## TDD Evidence

**RED (задача 1):** 5 из 85 тестов красные: `cat < .env`, `while read ... done < .env.local`, `bash -c "cat .env"`, `sh -lc 'head .envrc'` (все — `expected null not to be null`) и процессный `hook process denies input redirect from secret file` (`expected +0 to be 2`). `zsh -c 'source ./.env'` и `grep --file=.env x` уже были зелёными (аргумент вложенного скрипта и `--file=` у grep проверялись раньше) — они остаются регрессионной защитой. Семантическая оценка: целевые тесты выполнились и упали на утверждении о планируемом поведении, не на синтаксисе или фикстуре. `gsd_run check tdd-red-evidence` не запускался (`workflow.tdd_mode` не включён; RED проверен по выводу vitest).

**RED (задача 2):** 13 из 114 красные: 5 кейсов `blocks forced git add` (`.`, `-fA`, `--force -A`, `config/`, `'*.local'`), 7 кейсов `asks before writing agent config` и процессный `hook process asks before writing agent config`. Кейсы `git add -f .env`, `--force .env.local`, `.envrc` и `prefers deny over ask` уже были зелёными (секретный операнд ловит общая проверка чтения) — это ожидаемо.

**GREEN:** после каждой задачи vitest по двум файлам зелёный (114, затем 143 теста); `npm run check` зелёный (10 файлов, 253 теста).

## Smoke-проверка живого hook'а

Выполнена после каждой правки `shell.ts`, `hook-input.ts`, `protect-files.ts` (вход с `cwd`, иначе zod-схема отклоняет вызов):

- `ls` — `exit=0` во всех состояниях.
- `cat < .env` — `exit=2`, stderr: «protect-files: команда отклонена — .env: чтение секретных файлов .env* запрещено ...».
- `sed -i s/a/b/ .claude/x.md` — `exit=0`, stdout: `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"protect-files: .claude/x.md: правка конфигурации агента в .claude/ требует подтверждения."}}`.
- `cp .env .claude/x` — `exit=2` (deny приоритетнее ask).
- Сбоя «отказ на всё» не было.

## Files Created/Modified

- `.claude/hooks/lib/shell.ts` — `readTargets`, оператор `<<` для heredoc и here-string.
- `.claude/hooks/lib/hook-input.ts` — `exitWithAsk`.
- `.claude/hooks/protect-files.ts` — `checkCommand`/`checkSegment`, вложенный shell, `optionValues`, `gitAddForceDecision`, `agentConfigAsk`, ask в `isMain`.
- `tests/unit/protect-files.test.ts` — только добавления: 4 новых `describe`, 3 процессных/сквозных кейса, отдельная строка импорта `checkBashDecision`.

## Decisions Made

- Превышение глубины вложенности shell (более 3) — отказ с причиной, а не пропуск: план требует глубину не больше 3, молчаливый пропуск оставил бы обход «четыре `bash -c` подряд».
- Префикс магического pathspec распознаётся шире плана: любой аргумент, начинающийся с `:` (не только `:/`), считается широким — безопасное расширение в сторону отказа.
- Импорт `checkBashDecision` добавлен отдельной строкой, а не правкой существующей — чтобы не изменять существующие строки теста (критерий «ни одной удалённой строки»); ESLint это принимает.

## Deviations from Plan

None - plan executed exactly as written.

Замечание, не отклонение: промежуточная правка `protect-files.ts` (импорт `exitWithAsk` до добавления его использования) на секунду дала ESLint-ошибку `no-unused-vars` от PostToolUse-hook'а; следующая правка из той же серии закрыла её, ничего не отключалось.

## Issues Encountered

- Смоук-команда из плана (`echo '{"tool_name":"Bash","tool_input":{"command":"ls"}}' | tsx ...`) без поля `cwd` даёт код 2 из-за обязательного `cwd` в zod-схеме hook'а; в проверках использован вход с `"cwd":"/tmp"`. Это ограничение формулировки плана, не регрессия: реальный Claude Code всегда передаёт `cwd`.

## Известные ограничения (для checklist / memory, план 01-03)

- Hook — эвристика, не песочница: не раскрываются `$VAR`, `$(...)`, глобы вида `.e*`, `python -c`, `node -e`, `eval`; вложенный shell распознаётся только для `sh/bash/zsh/dash` с `-c`.
- `git add -f` с каталогом без завершающего `/` (например `git add -f config`) широким pathspec не считается; глобальные опции git до `add` (`git -C dir add -f .`) не разбираются. Секретный `.env*` в таких командах всё равно ловит общая проверка чтения.
- `git commit --message=.env` отклонится (значение `--опция=` проверяется как путь) — редкий лишний отказ в сторону безопасности.
- Значение опции отдельным аргументом (`-A 3`) у grep по-прежнему сойдёт за шаблон (ограничение из 01-02).

## Для end-of-phase human-check (план 01-03)

- В живой сессии выполнить `echo x >> .claude/hooks/tmp-check.ts` и убедиться, что показан запрос подтверждения (причина содержит `.claude/`), затем отклонить запрос.
- В живой сессии убедиться, что `cat < .env` отклонён, а `cat <<< .env` и `git add src/x.ts` проходят.

## Known Stubs

None.

## Threat Flags

None - новых сетевых точек, путей аутентификации или доступа к файлам вне threat_model плана нет. Закрыты T-01-06, T-01-14, T-01-15; T-01-09 принят (эвристика), T-01-16 митигирован vitest и smoke после каждой правки живого hook'а.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 01-03 (checklist) может ссылаться на тесты `blocks reading secret file`, `blocks forced git add`, `asks before writing agent config` и на ограничения выше.
- Блокеров нет.

## Self-Check: PASSED

- FOUND: .claude/hooks/lib/shell.ts, .claude/hooks/lib/hook-input.ts, .claude/hooks/protect-files.ts, tests/unit/protect-files.test.ts
- FOUND коммиты: 273c2d8, 52f64c7, a2a638b, f4e69b8 (все в HEAD)
- `npm run check` зелёный; в существующих строках теста удалений нет (`git diff d399063`: 0 строк `-`); `eslint-disable`/`@ts-ignore`/`.skip`/`.only` не добавлялись; `.env*` не читался и не создавался; `git add -f` реально не запускался.

---
*Phase: 01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti*
*Completed: 2026-10-25*
