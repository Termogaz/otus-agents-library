---
phase: 01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti
plan: 06
subsystem: infra
tags: [hooks, shell-tokenizer, secret-names, vitest, typescript]

requires:
  - phase: 01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti
    provides: protect-files, reviewer-readonly, общий isSecretPath (планы 01-02, 01-05)
provides:
  - токенизатор shell.ts, разбирающий кавычки, >|/>&, группировку и heredoc как bash
  - расширенный хвост секретного имени (WR-02) в secret-names.ts
  - isSecretOperand для операндов вида ключ=путь, @путь, ref:путь (основа CR-06)
affects: [01-07, 01-08, 01-09]

actuals:
  tokens: 7000
  tasks: 2
  commits: 4

plan_head_before: 59579e9e3ea8e63551707a585e33dd8745c384e2
plan_head_after: 185266c090197c8025d17c8a9e61421ec8b009bc

tech-stack:
  added: []
  patterns:
    - "Один токенизатор parseShell на оба hook'а: фикс разбора доходит до отказа существующим read/write-путём"
    - "Поиск heredoc со стеком контекстов (команда, кавычки, $((…)), $(…))"

key-files:
  created:
    - tests/unit/shell.test.ts
  modified:
    - .claude/hooks/lib/shell.ts
    - .claude/hooks/lib/secret-names.ts
    - tests/unit/protect-files.test.ts
    - tests/unit/secret-names.test.ts

key-decisions:
  - "Поиск heredoc ведёт стек контекстов, а не плоский флаг кавычки: heredoc внутри $(…) в двойных кавычках (git commit -m \"$(cat <<'EOF' …)\") по-прежнему распознаётся"
  - "( и ) всегда разделители сегмента, { и } — только отдельным словом; так a{b,c} и .env{,} остаются одним словом, а команда внутри $(…) становится отдельным сегментом"
  - "Дублирование дескриптора (>&1, >&2, >&-, >&3-) распознаётся по завершающему разделителю, >&2foo остаётся записью в файл 2foo"

patterns-established:
  - "Обход оболочки закрывается в токенизаторе и проверяется парой: юнит parseShell, кейс checkBashCommand и процессный тест настоящего hook'а"

requirements-completed: [SEC-02]

coverage:
  - id: D1
    description: "Токенизатор разбирает \\\" в кавычках, продолжение строки и префиксы $'…'/$\"…\"; обходы CR-01, CR-03 отклоняются protect-files"
    requirement: SEC-02
    verification:
      - kind: unit
        ref: "tests/unit/shell.test.ts#tokenizes escaped quote inside double quotes"
        status: pass
      - kind: unit
        ref: "tests/unit/protect-files.test.ts#checkBashCommand tokenizer bypasses"
        status: pass
    human_judgment: false
  - id: D2
    description: "Операторы >| и >&файл дают цель записи, >&1/>&2 остаются дублированием дескриптора (CR-02)"
    requirement: SEC-02
    verification:
      - kind: unit
        ref: "tests/unit/shell.test.ts#captures clobber and dup-to-file redirect targets"
        status: pass
      - kind: unit
        ref: "tests/unit/shell.test.ts#does not treat descriptor duplication as a file target"
        status: pass
    human_judgment: false
  - id: D3
    description: "Группировка (…), {…} и <(…) выделяют вложенную команду отдельным сегментом (CR-04)"
    requirement: SEC-02
    verification:
      - kind: unit
        ref: "tests/unit/shell.test.ts#splits subshell and grouping into separate segments"
        status: pass
      - kind: unit
        ref: "tests/unit/shell.test.ts#splits process substitution into a nested command segment"
        status: pass
    human_judgment: false
  - id: D4
    description: "Маркер << внутри кавычек и арифметики не начинает heredoc (CR-05, часть b); настоящий heredoc работает как раньше"
    requirement: SEC-02
    verification:
      - kind: unit
        ref: "tests/unit/shell.test.ts#ignores heredoc marker inside quotes and arithmetic"
        status: pass
      - kind: unit
        ref: "tests/unit/shell.test.ts#keeps existing heredoc redirect behavior"
        status: pass
    human_judgment: false
  - id: D5
    description: "Сквозной путь: настоящий hook (tsx, JSON на stdin) возвращает код 2 на обходы с \\\" и >|"
    requirement: SEC-02
    verification:
      - kind: integration
        ref: "tests/unit/protect-files.test.ts#hook process denies quoted-escape bypass"
        status: pass
      - kind: integration
        ref: "tests/unit/protect-files.test.ts#hook process denies clobber redirect"
        status: pass
    human_judgment: false
  - id: D6
    description: "Хвост секретного имени включает ~{},:# (WR-02), обрывки со скобкой и кавычкой по-прежнему не секрет"
    requirement: SEC-02
    verification:
      - kind: unit
        ref: "tests/unit/secret-names.test.ts#treats unusual env tail %s as secret file name"
        status: pass
    human_judgment: false
  - id: D7
    description: "isSecretOperand распознаёт секрет после =, @, : (основа CR-06); подключение к hook'ам — в планах 01-07 и 01-08"
    requirement: SEC-02
    verification:
      - kind: unit
        ref: "tests/unit/secret-names.test.ts#isSecretOperand"
        status: pass
    human_judgment: false

duration: 14 min
completed: 2026-10-25
status: complete
---

# Phase 1 Plan 06: токенизатор shell.ts и секретные имена Summary

**Токенизатор shell.ts приведён к bash в части `\"` в кавычках, `>|`/`>&файл`, `(…)`/`{…}`/`<(…)`, `$'…'` и heredoc вне кавычек и арифметики; secret-names.ts распознаёт `.env~`/`.env{,}` и получил `isSecretOperand` для операндов `=@:`**

## Performance

- **Duration:** 14 min
- **Started:** 2026-10-25T15:06:00Z (оценка, фиксация времени старта не велась)
- **Completed:** 2026-10-25T15:20:32Z
- **Tasks:** 2
- **Files modified:** 5 (из них 1 новый)

## Accomplishments

- Обходы CR-01…CR-04 и CR-05 (часть b) закрыты правкой одного токенизатора: команды `echo "\""; cat .env`, `cat $'.env'`, `(cat .env)`, `cat <(cat .env)`, `echo x >| .env`, `{ rm .git/index; }` попадают в уже существующий read/write-путь `protect-files` и отклоняются без изменения самого hook'а.
- Сквозной путь доказан процессными тестами: настоящий `tsx .claude/hooks/protect-files.ts` возвращает код 2 на `echo "\""; cat .env` и `echo x >| .env`.
- WR-02: `.env~`, `.env{,}`, `.env:x`, `.env#` снова секрет (fail-open закрыт), `.env*)` и `.env"}` по-прежнему нет.
- `isSecretOperand` готов к подключению в планах 01-07 (protect-files) и 01-08 (reviewer-readonly).
- Парные «легитимные» кейсы проходят: `echo "a\"b" > ok.txt`, `ls >&2`, `cmd 2>&1`, heredoc с телом и `<<'EOF'`.

## Task Commits

1. **Задача 1 (трассер): токенизатор shell.ts**
   - RED: `ea0fbc9` (test) — 23 падающих кейса: shell.test.ts, tokenizer bypasses, два процессных
   - GREEN: `a316e18` (fix)
2. **Задача 2: secret-names.ts**
   - RED: `cf01c48` (test) — 20 падающих кейсов
   - GREEN: `185266c` (fix)

**Plan metadata:** `.planning/` в git не коммитится (`commit_docs: false`).

## TDD Gate Compliance

RED (`test(01-06)`) предшествует GREEN в обеих задачах. GREEN-коммиты имеют тип `fix`, а не `feat`, — так прописано в плане (исправление существующего поведения); проверка `feat(01-06)` по журналу git этих коммитов не найдёт, это ожидаемо.

RED-доказательство: целевые тесты падали на утверждении о планируемом поведении (например, `words` не содержит `.env` после `echo "\""`, `isSecretOperand` не определена), а не на ошибке импорта или синтаксиса; существующие кейсы оставались зелёными (158 passed до GREEN).

Трассер: сквозная проверка (vitest по трём файлам и по фильтру `tokenizer bypasses`) повторена после GREEN, зелёная — расширение на задачу 2 разрешено.

## Files Created/Modified

- `.claude/hooks/lib/shell.ts` — tokenize: экранирование в `"…"`, `\<перевод строки>`, `$'…'`/`$"…"`, `>|`/`>&файл` против `>&N`, разделители `( ) { }`; stripHeredocBodies: стек контекстов (команда, кавычки, `$((…))`, `$(…)`)
- `.claude/hooks/lib/secret-names.ts` — ENV_NAME_TAIL с `~{},:#`; новый экспорт `isSecretOperand`
- `tests/unit/shell.test.ts` — новый, 13 юнит-тестов parseShell
- `tests/unit/protect-files.test.ts` — describe `checkBashCommand tokenizer bypasses`, два процессных теста
- `tests/unit/secret-names.test.ts` — кейсы расширенного хвоста и describe `isSecretOperand`

## Decisions Made

См. `key-decisions` во frontmatter. Главное: heredoc ищется со стеком контекстов, чтобы `git commit -m "$(cat <<'EOF' …)"` (heredoc внутри `$(…)` в двойных кавычках) продолжал распознаваться и тело сообщения не попадало в разбор как команды.

## Deviations from Plan

None - plan executed exactly as written.

Уточнение реализации (не отклонение): план описывал поиск `<<` «вне кавычек и арифметики»; вместо плоского флага кавычки использован стек контекстов, чтобы не сломать heredoc внутри `$(…)`.

## Issues Encountered

- Первая версия `shell.ts` не прошла `tsc`: объединённый тип `kind: 'single' | 'double' | 'ansi'` не сужал union; тип разделён на отдельные члены (поведение не менялось, vitest был зелёным и до правки).
- Живой hook не отклонил ни одной команды исполнителя, откат файлов не потребовался.

## Known Stubs

None.

## Threat Flags

None - новой поверхности (сеть, auth, файловый доступ) не добавлено; изменения ужесточают существующую проверку (T-01-19, T-01-20 смягчены).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Остаётся открытым (по плану — 01-07/01-08): fail-closed для подстановок и вложенных интерпретаторов, подключение `isSecretOperand` к hook'ам, CR-07, WR-01, WR-03, WR-04. До тех пор `$VAR`, `$(…)` как значение имени, `python -c`, `eval`, `$'\x2eenv'` остаются обходами.
- Владелец записи WR-05, WR-06, WR-07, IN-03 — checklist плана 01-09; IN-01 — `docs/memory.md`, «Дальше».

## Self-Check: PASSED

- FOUND: tests/unit/shell.test.ts, .claude/hooks/lib/shell.ts, .claude/hooks/lib/secret-names.ts
- FOUND коммиты: ea0fbc9, a316e18, cf01c48, 185266c
- `npm run check` зелёный (typecheck, lint, format:check, 305 тестов)
- существующие строки тестов не удалены (`git diff d399063` — 0 удалённых строк), `eslint-disable`/`@ts-ignore`/`.skip`/`.only` не добавлены
