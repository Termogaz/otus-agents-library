---
phase: 01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti
plan: 08
subsystem: security
tags: [hooks, protect-files, reviewer-readonly, vitest, gitignore, claude-code]

requires:
  - phase: 01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti
    provides: "isSecretOperand и fail-closed в protect-files (01-06, 01-07)"
provides:
  - "reviewer-readonly проверяет операнды git read-подкоманд и запрещает --no-index (CR-07)"
  - "protect-files снимает префиксы первой команды (присваивания, обёртки, ключевые слова, опции sudo) перед определением программы (WR-01)"
  - "protect-files знает писателей dd of=, curl -o/-D/-c, wget -O/-o/-a и цель -t/--target-directory у cp/mv/install/ln (WR-01)"
  - "gitAddForceDecision видит глобальные опции git, сокращённый --forc и широкий pathspec (.., каталог без точки) (WR-03)"
  - ".envrc в .gitignore, игнор закреплён тестом (WR-03)"
affects: [01-09, security-checklist]

actuals:
  tokens: 4600
  tasks: 3
  commits: 6

plan_head_before: a33dd2cd0137ecdcbdcafb953cf2602562815517
plan_head_after: 4c4b98358c57d2fcb1f5aca53391929960a603b2

tech-stack:
  added: []
  patterns:
    - "Снятие префиксов команды одной функцией stripCommandPrefixes, общей для проверки записи и fail-closed"
    - "Таблицы данных вместо ветвлений: WRAPPER_PROGRAMS, SHELL_KEYWORDS, OUTPUT_FILE_OPTIONS, GIT_GLOBAL_OPTIONS_WITH_VALUE"

key-files:
  created: []
  modified:
    - .claude/hooks/protect-files.ts
    - .claude/hooks/reviewer-readonly.ts
    - .gitignore
    - tests/unit/protect-files.test.ts
    - tests/unit/reviewer-readonly.test.ts

key-decisions:
  - "Обёртки с опциями-без-значения (sudo -h) не съедают следующее слово: иначе настоящая команда стала бы «аргументом» и обошла проверку"
  - "env -S 'строка' разворачивается в слова команды, а не пропускается"
  - "При форсе путь без точки в basename (src, config, Makefile) считается широким pathspec; каталог с точкой в имени (my.dir) остаётся ограничением"
  - "--no-index сравнивается точным совпадением: сокращения неоднозначны (--no-inde... совпадает ещё с --no-indent-heuristic)"

patterns-established:
  - "Проверка игнора секретного файла — тестом vitest через spawnSync git check-ignore, а не Bash-командой исполнителя"

requirements-completed: [SEC-02, SEC-03]

duration: 5min
completed: 2026-10-25
status: complete
---

# Phase 1 Plan 08: обходы записи и чтения секретов через обёртки, git add -f и git read Summary

**protect-files снимает префиксы команды (FOO=1, env, nohup, xargs, then, sudo -u), знает dd/curl/wget/-t и git add -f с глобальными опциями; reviewer-readonly не читает .env через git diff/show/log; .envrc в .gitignore**

## Performance

- **Duration:** 5 min
- **Started:** 2026-10-25T15:34:23Z
- **Completed:** 2026-10-25T15:39:39Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- CR-07: `reviewer-readonly` отклоняет `git diff --no-index /dev/null <секрет>`, `git show HEAD:<секрет>`, `git show :<секрет>`, `git log -p -- <секрет>`, `git diff HEAD <секрет>` и запрещает `--no-index` целиком; `git diff main...HEAD`, `git show <ref>:docs/plan.md`, `git log --oneline` проходят.
- WR-01: `stripCommandPrefixes` убирает присваивания `NAME=value`, ключевые слова `if/elif/while/until/then/do/else/!/{`, обёртки `env/command/nohup/time/exec/nice/timeout N/xargs/setsid/builtin/sudo` вместе с опциями и значениями (`env -u X`, `sudo -u root`, `timeout 5`); результат используется и в проверке записи, и в `unmodellableReason` (fail-closed).
- WR-01: недостающие писатели `dd of=`, `curl -o/-D/-c/--output`, `wget -O/-o/-a/--output-document`, цель `-t`/`--target-directory` у `cp/mv/install/ln` (в том числе в кластере `-rt DIR`): защищённый файл — deny, `.claude/` — ask.
- WR-03: `gitAddForceDecision` снимает глобальные опции git (`-C`, `-c`, `--git-dir`, `--work-tree` и др.), распознаёт сокращённый `--forc`/`--fo` и считает широким pathspec `..`, `../..`, а также путь без точки в basename (`src`, `config`).
- WR-03: `.envrc` добавлен в `.gitignore`; тест `gitignore keeps envrc out of plain git add` вызывает `git check-ignore` внутри vitest.
- `npm run check` зелёный: 441 тест, lint, typecheck, prettier.

## Task Commits

1. **Задача 1 (трассер): reviewer не читает секрет через git diff/show/log (CR-07)**
   - RED `3ddaad6` (test) — 7 из 47 тестов красные
   - GREEN `2ea96b5` (fix)
2. **Задача 2: префиксы первой команды и недостающие писатели (WR-01)**
   - RED `383da44` (test) — 13 из 24 новых кейсов красные
   - GREEN `c17da38` (fix)
3. **Задача 3: git add -f с глобальными опциями, .envrc в .gitignore (WR-03)**
   - RED `6432c7e` (test) — 7 красных: 6 блокирующих кейсов и тест игнора
   - GREEN `4c4b983` (fix)

**Plan metadata:** коммит SUMMARY не создаётся (`commit_docs: false`, `.planning/` не в git).

## TDD Gate Compliance

Для каждой задачи RED-коммит `test(01-08)` предшествует GREEN-коммиту `fix(01-08)`; REFACTOR-коммитов нет (не требовались).

Семантическая оценка RED (классификатор `gsd_run check tdd-red-evidence` не запускался: формат отчёта — вывод vitest, записи evidence-файлов план не требует):

- Задача 1: упали ровно целевые `git read operands > blocks git read of secret file` (6) и `blocks git --no-index entirely` (1), на `expected null not to be null`. Допускающие кейсы остались зелёными, существующие 40 тестов не затронуты.
- Задача 2: упали целевые 13 кейсов `write prefixes and writers` на проверках `not.toBeNull()` / `decision === 'ask'`. Кейс `mv -t .claude/dir a.ts` был зелёным ещё до правки (`mv` уже трактует любой аргумент как цель записи) — оставлен как закрепление поведения. Легитимные 8 кейсов зелёные.
- Задача 3: упали 6 блокирующих кейсов `git add global opts` и `gitignore keeps envrc out of plain git add` (`status` 1, файл не игнорировался); 4 допускающих кейса зелёные.

## Files Created/Modified

- `.claude/hooks/protect-files.ts` — `stripCommandPrefixes`/`skipWrapperOptions`, `targetDirectory`, `outputFileTargets`, `stripGitGlobalOptions`, расширенный `gitAddForceDecision`; константы `WRAPPER_PROGRAMS`, `SHELL_KEYWORDS`, `OUTPUT_FILE_OPTIONS`, `TARGET_DIRECTORY_PROGRAMS`.
- `.claude/hooks/reviewer-readonly.ts` — проверка `--no-index` и операндов git read-подкоманд через `isSecretOperand`.
- `.gitignore` — строка `.envrc`.
- `tests/unit/protect-files.test.ts` — `write prefixes and writers`, `git add global opts`, `gitignore keeps envrc out of plain git add` (только добавления, существующие кейсы не изменены).
- `tests/unit/reviewer-readonly.test.ts` — `git read operands`.

## Decisions Made

См. `key-decisions` во frontmatter. Контракт `checkBashCommand`/`checkBashDecision`/`checkFilePath`/`checkReviewerCommand` сохранён; deny записи `.env*`/`.git/`/`package-lock.json` не ослаблен; `.claude/` остаётся ask, в том числе через `cp/mv -t` и `env sed -i`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Критерий «1 passed» для фильтра `gitignore keeps envrc` не выполним буквально**
- **Found during:** Задача 3 (acceptance_criteria)
- **Issue:** фильтр `-t "gitignore keeps envrc"` совпадает не только с новым тестом, но и с двумя элементами массива `PLAN_COMMANDS` (W2-страж), имена которых содержат эту подстроку: итог `3 passed`, а не `1 passed`.
- **Fix:** ничего не менял — страж из 01-07 по плану не удаляется; тест игнора проходит (`passed`, 0 failed). Записано как расхождение критерия с фактом.
- **Files modified:** нет
- **Verification:** `npx vitest run tests/unit/protect-files.test.ts -t "gitignore keeps envrc"` — `3 passed`, среди них целевой тест

**2. [Rule 3 - Blocking] Самосрабатывание страж-грепа на литерал команды в W2-массиве**
- **Found during:** итоговая проверка (grep по добавленным строкам на `eslint-disable|@ts-ignore|.skip(|.only(`)
- **Issue:** единственное совпадение — литерал самой команды-проверки в массиве `PLAN_COMMANDS` (`tests/unit/protect-files.test.ts`), добавленный в 01-07; настоящих `.skip`/`.only`/`eslint-disable`/`@ts-ignore` нет.
- **Fix:** не требуется; страж не удалялся.
- **Files modified:** нет

---

**Total deviations:** 2 зафиксированы как расхождения проверок с фактом (1 по Rule 1, 1 по Rule 3), кода не меняли.
**Impact on plan:** на реализацию не влияет.

## Issues Encountered

- Живой hook `protect-files` отклонил мою Bash-команду, где heredoc с Python-скриптом упоминал токен секретного файла (подстановка `$(` + токен — fail-closed из 01-07). Это ожидаемое поведение; правку выполнил инструментом Edit, а не Bash. Ложных отказов на собственных git/vitest/npm-командах плана не было; тест `executor commands of gap-closure plans` зелёный после каждой задачи.
- Постправочный hook `format-and-lint` на промежуточных правках `protect-files.ts` ругался на неиспользуемые константы/функции (они подключались следующей правкой) и на `no-useless-assignment` — устранено в рамках той же задачи.

## Известные ограничения (для checklist 01-09)

- `git add -f <каталог-с-точкой-в-имени>` (`my.dir`) принимается эвристикой за файл; при форсе `git add -f Makefile`/`LICENSE` (без точки) — ложный отказ.
- `curl -O http://x/package-lock.json` (имя берётся из URL) не раскрывается; `curl`/`wget` опции других писателей (`--trace`, `-P`) не моделируются.
- Снятие префиксов не раскрывает произвольный DSL: `find … -delete/-exec rm`, `git rm/checkout/restore/apply` по защищённым файлам (остаток WR-01, шаг 7в checklist).
- `env -S` с присоединённым значением (`-S'cmd'`) не раскрывается; `--no-index` проверяется точным совпадением.
- Неоднозначные сокращения длинных флагов `git` (кроме `--forc`/`--fo` для `add -f`) не моделируются.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

Новых поверхностей вне threat_model плана нет. Угрозы T-01-24, T-01-25, T-01-26 закрыты тестами `git read operands`, `write prefixes and writers`, `git add global opts`, `gitignore keeps envrc`.

## Next Phase Readiness

Готов план 01-09 (security-checklist, memory, README). Имена тестов для checklist: `git read operands`, `write prefixes and writers`, `git add global opts`, `gitignore keeps envrc`.

## Self-Check: PASSED

- Изменённые файлы существуют: `.claude/hooks/protect-files.ts`, `.claude/hooks/reviewer-readonly.ts`, `.gitignore`, `tests/unit/protect-files.test.ts`, `tests/unit/reviewer-readonly.test.ts`.
- Коммиты в истории: `3ddaad6`, `2ea96b5`, `383da44`, `c17da38`, `6432c7e`, `4c4b983`.
- `npm run check` — зелёный (441 тест).

---
*Phase: 01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti*
*Completed: 2026-10-25*
