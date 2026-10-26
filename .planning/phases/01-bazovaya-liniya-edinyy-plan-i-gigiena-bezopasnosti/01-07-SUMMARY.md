---
phase: 01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti
plan: 07
subsystem: infra
tags: [hooks, protect-files, fail-closed, secret-operand, vitest, typescript]

requires:
  - phase: 01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti
    provides: isSecretOperand и исправленный токенизатор shell.ts (план 01-06)
provides:
  - protect-files проверяет read-операнды через isSecretOperand (dd if=, curl @, git show ref:путь) — CR-06
  - fail-closed backstop: немоделируемая конструкция + секретный токен в тексте = отказ (CR-05, остаток CR-01..04)
  - ask для рекурсивного grep/rg по корню проекта (WR-04)
  - страж executor commands of gap-closure plans — команды исполнителя 01-07..01-09 не получают deny
affects: [01-08, 01-09]

actuals:
  tokens: 4500
  tasks: 2
  commits: 4

plan_head_before: 185266c090197c8025d17c8a9e61421ec8b009bc
plan_head_after: a33dd2cd0137ecdcbdcafb953cf2602562815517

tech-stack:
  added: []
  patterns:
    - "Точечные фиксы дополнены fail-closed: немоделируемая конструкция отклоняется только при упоминании секрета в сыром тексте"
    - "Тест-страж живого hook'а: дословные команды исполнителя будущих планов прогоняются через checkBashDecision"

key-files:
  created: []
  modified:
    - .claude/hooks/protect-files.ts
    - tests/unit/protect-files.test.ts

key-decisions:
  - "Fail-closed проверяется только на верхнем уровне (depth 0): вложенный скрипт входит в исходную команду целиком"
  - "Приоритет: deny сегмента > fail-closed deny > ask — fail-closed перекрывает ask (безопаснее плановой формулировки «нет ask»)"
  - "rg без --hidden/-u/--no-ignore по корню не спрашивает: ripgrep пропускает скрытые файлы, .env не читается; grep -r без пути — корень"
  - "Любой --exclude* считается явным сужением (в том числе --exclude-dir=.git): требование теста плана, остаток отмечен в ограничениях"

patterns-established:
  - "Каждое правило fail-closed сопровождается парным тестом: соседняя легитимная команда проходит"

requirements-completed: [SEC-02]

coverage:
  - id: D1
    description: "Read-операнды вида if=путь, @путь, ref:путь проверяются через isSecretOperand (CR-06); пары легитимных операндов проходят"
    requirement: SEC-02
    verification:
      - kind: unit
        ref: "tests/unit/protect-files.test.ts#checkBashCommand operand and fail-closed"
        status: pass
    human_judgment: false
  - id: D2
    description: "Fail-closed (CR-05): канал/heredoc/here-string в shell, eval, python/perl со скриптом в аргументе и подстановка переменной с секретным токеном отклоняются; bash scripts/build.sh, echo с датой, grep-шаблоны с токеном проходят"
    requirement: SEC-02
    verification:
      - kind: unit
        ref: "tests/unit/protect-files.test.ts#checkBashCommand operand and fail-closed"
        status: pass
      - kind: integration
        ref: "tests/unit/protect-files.test.ts#hook process denies piped shell secret read"
        status: pass
      - kind: integration
        ref: "tests/unit/protect-files.test.ts#hook process denies operand-hidden secret read"
        status: pass
    human_judgment: false
  - id: D3
    description: "Рекурсивный grep/rg по корню проекта даёт ask; подкаталог и --exclude проходят; секретный путь остаётся deny (WR-04)"
    requirement: SEC-02
    verification:
      - kind: unit
        ref: "tests/unit/protect-files.test.ts#checkBashDecision recursive grep"
        status: pass
    human_judgment: false
  - id: D4
    description: "Ни одна из 49 команд исполнителя планов 01-07..01-09 (verify, acceptance, коммиты, коммит через heredoc, образец gsd_run) не получает deny"
    requirement: SEC-02
    verification:
      - kind: unit
        ref: "tests/unit/protect-files.test.ts#executor commands of gap-closure plans"
        status: pass
    human_judgment: false
  - id: D5
    description: "Поведение живого hook'а в сессии (отклонение git show HEAD:путь, канала в shell) подтверждается руками в конце фазы"
    verification: []
    human_judgment: true
    rationale: "Ручная проверка живой сессии — end-of-phase human-check плана 01-09"

duration: 4 min
completed: 2026-10-25
status: complete
---

# Phase 1 Plan 07: операнды, fail-closed и рекурсивный grep в protect-files Summary

**protect-files проверяет операнды `if=`/`@`/`ref:` через isSecretOperand, отклоняет по fail-closed немоделируемые конструкции (канал и heredoc в shell, eval, `python -c`, `$VAR`) при упоминании секрета и спрашивает подтверждение у рекурсивного grep/rg по корню**

## Performance

- **Duration:** 4 min
- **Started:** 2026-10-25T15:27:06Z
- **Completed:** 2026-10-25T15:30:45Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- CR-06: `secretReadDecision` теперь использует `isSecretOperand`; `dd if=.env`, `curl -d @.env`, `curl -F f=@.env`, `git show HEAD:.env`, `git show :.env` отклоняются, а `dd if=out.bin`, `curl -d @README.md`, `git show HEAD:src/app.ts` проходят.
- CR-05: добавлены `unmodellableReason(command)` и `mentionsSecretToken(command)`; сведение в `checkCommand` на верхнем уровне. Отклоняются `echo 'cat …' | bash`, `bash <<EOF`, `bash <<<`, `sh -s <<<`, `eval`, `python3 -c`, `perl -e`, `X=…; cat $X` с секретным токеном; легитимные `bash scripts/build.sh`, `echo "$(date)"`, `npm test | tee out.log`, `git commit -m "fix: … parsing"`, `python3 -c "print(1)"` проходят.
- WR-04: `recursiveRootSearchAsk` даёт `ask` для `grep -r/-R/-rn` по `.`/`./`/`..` (и без пути), для `rg` с `--hidden`/`-u`/`--no-ignore`; `src/`, `lib`, `--exclude*`, нерекурсивный grep проходят; `grep -r KEY <секретный путь>` остаётся `deny`.
- Сквозной путь: настоящий tsx возвращает код 2 для `git show HEAD:…` и канала в shell.
- Страж W2 `executor commands of gap-closure plans`: 49 дословных команд планов 01-07, 01-08, 01-09 не получают `deny` (проверен после каждой правки hook'а).

## Task Commits

1. **Задача 1 (трассер): операнды и fail-closed**
   - RED: `a3f737e` (test) — 16 падающих кейсов: 14 блокирующих + 2 процессных; легитимные и страж команд исполнителя зелёные
   - GREEN: `d325c6e` (fix)
2. **Задача 2: рекурсивный grep**
   - RED: `16f8f4a` (test) — 7 падающих ask-кейсов
   - GREEN: `a33dd2c` (fix)

**Plan metadata:** `.planning/` в git не коммитится (`commit_docs: false`).

## TDD Gate Compliance

RED (`test(01-07)`) предшествует GREEN в обеих задачах. GREEN-коммиты имеют тип `fix`, а не `feat`, как прописано в плане; проверка `feat(01-07)` по журналу git их не найдёт — ожидаемо.

RED-доказательство (семантическая оценка): целевые тесты падали на утверждении планируемого поведения (`checkBashCommand(...)` вернул null вместо причины; `checkBashDecision(...)?.decision` равно null вместо `ask`; процессные — код выхода 0 вместо 2), а не на ошибке импорта, синтаксиса или нулевом числе тестов. До GREEN: 16 failed / 193 passed и 7 failed / 217 passed. Формат отчёта `gsd_run check tdd-red-evidence` не прогонялся (`workflow.tdd_mode` не включён).

Трассер: сквозная проверка (vitest по `protect-files` и `secret-names`, фильтры `operand and fail-closed` — 26 passed, `gap-closure plan command` — 49 passed) повторена после GREEN, зелёная — расширение на задачу 2 разрешено.

## Files Created/Modified

- `.claude/hooks/protect-files.ts` — `isSecretOperand` в `secretReadDecision`; константы `SHELL_STDIN_FORM`, `PIPE_TO_SHELL`, `EVAL_WORD`, `SCRIPT_INTERPRETERS`, `SCRIPT_FLAG`; `unmodellableReason`, `mentionsSecretToken`, fail-closed в `checkCommand`; `isRootPath`, `recursiveRootSearchAsk` и вызов в `checkSegment`
- `tests/unit/protect-files.test.ts` — describe `checkBashCommand operand and fail-closed`, `checkBashDecision recursive grep`, `executor commands of gap-closure plans` (49 команд), два процессных кейса; существующие строки не удалены

## Decisions Made

См. `key-decisions` во frontmatter. Главное: fail-closed срабатывает только при совпадении двух условий (немоделируемая конструкция и секретный токен в сыром тексте), поэтому легитимные команды без секрета не затронуты.

## Deviations from Plan

None - plan executed exactly as written.

Уточнения реализации (не отклонения):
- Приоритет «fail-closed deny перекрывает ask» (план в двух местах формулировал по-разному: «нет deny и ни одного ask» и «обычный deny > fail-closed deny > ask»); выбран второй вариант как более безопасный.
- Имя ask-теста «allows recursive grep that cannot reach secrets» (содержит подстроку из `-t "allows recursive grep that cannot reach"`, фильтры плана выбирают тесты).

## Issues Encountered

- Acceptance-критерий Задачи 2 `d=$(git diff d399063 -- …) && test "$(… | grep -cE '^\+.*(eslint-disable|@ts-ignore|\.skip\(|\.only\()')" -eq 0` не проходит буквально: он находит одну добавленную строку — сам же дословный текст этой команды в массиве стража `PLAN_COMMANDS` (план требует включить её в тест). Реальных `eslint-disable`/`@ts-ignore`/`.skip(`/`.only(` не добавлено. Для 01-09 стоит учесть, что такой самосовпадающий критерий нужно исключать фильтром по строке стража.
- Промежуточные ошибки ESLint «defined but never used» после первой правки каждого этапа (константы и импорт добавлялись раньше использования) — исчезли после завершения правки; живой hook не отклонил ни одной команды исполнителя, откат не потребовался.

## Known Stubs

None.

## Threat Flags

None - новой поверхности не добавлено; изменения ужесточают существующую проверку (T-01-21, T-01-23 смягчены; T-01-22, T-01-29 покрыты парными тестами и стражем).

## User Setup Required

None - no external service configuration required.

## Известные ограничения (для checklist плана 01-09)

- Значение, собранное без буквального токена (`X=.en; cat ${X}v`), и скрипт интерпретатора, собранный подстановкой, не раскрываются; `$VAR` с буквальным токеном (`X=.env; cat $X`) отклоняется.
- Fail-closed даёт ложные отказы командам, где `.env*` упомянут рядом с `$(…)`, каналом в shell, heredoc или `eval` (WR-06), например коммит через `$(cat <<'EOF' … EOF)` с токеном в сообщении.
- Любой `--exclude*` у grep (включая `--exclude-dir=.git`, который `.env` не исключает) считается сужением и не вызывает `ask`; `rg` без `--hidden`/`-u`/`--no-ignore` не спрашивает.
- `bash -s -- аргумент` на конце канала не распознаётся как shell со stdin (шаблон допускает только флаги после имени); `python`/`node` со скриптом из heredoc без секретного токена в `-c`-форме не считаются немоделируемыми (существующий кейс «python3 - <<'EOF'» должен проходить).

## Next Phase Readiness

- Готов план 01-08 (волна 3): префиксы и писатели, `git add -f`, reviewer — тот же `protect-files.ts`; тест-страж команд исполнителя уже в `protect-files.test.ts` и перепроверяется их vitest.
- Блокеров нет; `npm run check` зелёный (396 тестов).

## Self-Check: PASSED

- FOUND: `.claude/hooks/protect-files.ts`, `tests/unit/protect-files.test.ts`
- FOUND коммиты: a3f737e, d325c6e, 16f8f4a, a33dd2c
- `npm run check` зелёный (typecheck, lint, format:check, 396 тестов); удалённых файлов в последнем коммите нет; существующие строки тестов не удалены (`git diff d399063` — 0 удалённых строк)

---
*Phase: 01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti*
*Completed: 2026-10-25*
