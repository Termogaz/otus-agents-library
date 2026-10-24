# Phase 1: Базовая линия, единый план и гигиена безопасности - Pattern Map

**Mapped:** 2026-10-24
**Files analyzed:** 15 (2 новых, 13 изменяемых)
**Analogs found:** 15 / 15 (для новых файлов аналог — соседний tracked-файл)

Все аналоги — git-tracked (проверено `git ls-files`), кроме `.claude/hooks/gsd-secret-read-guard.js`: он НЕ в git (D-10), используется только как справочник списка шаблонов, копировать из него код нельзя.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `.claude/hooks/lib/secret-names.ts` (NEW) | utility | transform | `.claude/hooks/lib/shell.ts` | role-match |
| `.claude/hooks/lib/hook-input.ts` (mod: вывод `ask`) | utility | request-response | сам файл (`exitWithFeedback`) | exact |
| `.claude/hooks/protect-files.ts` (mod) | hook/middleware | request-response | сам файл | exact |
| `.claude/hooks/lib/shell.ts` (mod, при необходимости) | utility | transform | сам файл | exact |
| `.claude/hooks/reviewer-readonly.ts` (mod) | hook/middleware | request-response | `protect-files.ts` | exact |
| `.claude/agents/reviewer.md` (проверка, вероятно без правок) | config | request-response | сам файл | exact |
| `.claude/settings.json` (mod) | config | — | сам файл | exact |
| `tests/unit/protect-files.test.ts` (mod) | test | transform | сам файл | exact |
| `tests/unit/reviewer-readonly.test.ts` (mod) | test | transform | сам файл | exact |
| `tests/unit/secret-names.test.ts` (NEW, опционально) | test | transform | `tests/unit/protect-files.test.ts` | exact |
| `docs/security-checklist.md` (NEW) | doc | — | таблицы `docs/about.md` (строки 12-22, 33+) | role-match |
| `docs/plan.md`, `CLAUDE.md`, `AGENTS.md`, `.planning/PROJECT.md`, `docs/memory.md` (mod) | doc | — | сами файлы | exact |

## Pattern Assignments

### `.claude/hooks/lib/secret-names.ts` (NEW; utility, transform)

**Analog:** `.claude/hooks/lib/shell.ts` (чистые экспортируемые функции, русский комментарий в шапке, без I/O) и текущий `protectedReason` из `protect-files.ts` (строки 13-21).

**Текущая логика, которую выносим** (`protect-files.ts` 13-16):
```typescript
function protectedReason(file: string): string | null {
  const normalized = path.posix.normalize(file.replaceAll('\\', '/'));
  const base = path.posix.basename(normalized);
  if (base.startsWith('.env')) return `${file}: файлы .env* содержат секреты`;
```

**Что сделать (D-08):** экспортировать `isSecretFileName(base: string): boolean`/`isSecretPath(file: string)`: `base.startsWith('.env')` (включая `.envrc`, `.env.local`), кроме `TEMPLATES = new Set(['.env.example', '.env.sample', '.env.template'])` (в справочнике guard есть ещё `.env.dist` — решение D-08 его не включает, не добавлять без согласования). Нормализация такая же: `replaceAll('\\','/')` → `path.posix.normalize` → `basename`. Импорты с суффиксом `.js` (как в `./lib/hook-input.js`).

ВАЖНО: для ЗАПИСИ `.env.example` остаётся защищённым (существующий тест `blocks writing to env file .env.example` в `protect-files.test.ts` строка 7); исключение шаблонов действует только для ЧТЕНИЯ. Поэтому модуль должен давать два предиката (например `isEnvFile` — любой `.env*`, и `isSecretFile` — без шаблонов), либо флаг.

---

### `.claude/hooks/lib/hook-input.ts` (mod: решение `ask`)

**Analog:** `exitWithFeedback` (строки 31-35):
```typescript
// Код 2: для PreToolUse — отказ, для PostToolUse — сообщение агенту; stderr уходит агенту.
export function exitWithFeedback(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}
```
**Добавить** соседнюю функцию в том же стиле (D-12): stdout JSON и `process.exit(0)`:
```typescript
export function exitWithAsk(reason: string): never {
  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason: reason,
      },
    })}\n`,
  );
  process.exit(0);
}
```
Формат `hookSpecificOutput.permissionDecision` — по документации установленной версии Claude Code (проверить). Схема входа (`hookInputSchema`, строки 6-13) менять не нужно: `file_path` и `command` уже есть.

---

### `.claude/hooks/protect-files.ts` (mod; hook, request-response)

**Analog:** сам файл.

**Паттерн «чистая функция + тонкий isMain»** (строки 56-68) сохранить. Сейчас `checkFilePath`/`checkBashCommand` возвращают `string | null`. Для `ask` нужен трёхзначный результат. Рекомендация: не ломать сигнатуру существующих тестов (`not.toBeNull()`/`toBeNull()`) — добавить новые экспорты (напр. `checkBashDecision(command): { decision: 'deny' | 'ask'; reason: string } | null`), а `checkBashCommand` оставить как «deny-причина или null» (ask-случаи для него — null) либо обновить тесты осознанно.

**Чтение секретов (D-05):** по образцу цикла по сегментам (строки 31-53) — для чтения проверять АРГУМЕНТЫ-ПУТИ, а не подстроки:
```typescript
for (const { words, writeTargets } of parseShell(command)) {
  const [name, ...args] = words[0] === 'sudo' ? words.slice(1) : words;
  const program = path.posix.basename(name);
  const files = args.filter((a) => !a.startsWith('-'));
```
Любой `file` из `files`, у которого basename — секрет (`isSecretFile`), → отказ (`cat ./.env`, `grep x .env`, `less`, `head`, `tail`, абсолютные/относительные пути). Шаблон `grep '\.env' other.ts` не блокируется, так как basename `\.env`.. нужно проверить, что `\.env` не совпадёт: `path.posix.basename('\\.env')` после `replaceAll('\\','/')` даст `.env` — ЛОВУШКА: нормализация обратных слешей превратит `\.env` в `/.env`. Для чтения не применять замену `\\`→`/`, либо исключать слова с regex-метасимволами; покрыть тестом «шаблон `'\.env'` в grep по другому файлу — не чтение секрета». Также `git commit -m "... .env.example ..."` (тест строка 58) — одно слово с пробелами, basename не секрет; убедиться, что `-m`-значение не ломается (`files` содержит и значение сообщения).

**git add -f (D-09):** добавить ветку `program === 'git'` + `args[0] === 'add'` + флаг `-f`/`--force` (учесть склеенные `-fA`: по образцу `isInPlaceFlag`, строки 27-29: `/^-[a-zA-Z]*f/`) + путь `.env*` (`isEnvFile`) → отказ.

**Запись в `.claude/` через Bash (D-12):** переиспользовать таблицы `WRITES_ANY_ARG`, `WRITES_LAST_ARG`, `IN_PLACE_EDITORS` и `writeTargets` (строки 6-11, 32-36, 43-51): те же кандидаты проверять на `normalized.split('/').includes('.claude')` → результат `ask`, не отказ. Приоритет: если цель одновременно deny и ask — deny. `.env*`, `.git/`, `package-lock.json` остаются отказом.

**Вывод (строки 56-68):**
```typescript
if (isMain(import.meta.url)) {
  try {
    const { tool_name, tool_input } = readHookInput();
    ...
    if (reason) exitWithFeedback(`Запись в защищённый файл заблокирована hook'ом: ${reason}.`);
  } catch (error) {
    // Не смогли разобрать вход — лучше запретить, чем пропустить запись.
    exitWithFeedback(`protect-files: не удалось проверить вызов (${String(error)}).`);
  }
}
```
Для чтения секретов формулировка сообщения должна быть другой (не «Запись…»). Для `Read`-инструмента hook не подключён (matcher `Edit|Write|Bash`) — Read закрывает deny в settings.json (D-06).

---

### `.claude/hooks/reviewer-readonly.ts` (mod; D-07)

**Analog:** `protect-files.ts` (общий каркас) и собственная ветка (строки 28-51).

Сейчас строка 36 пропускает любой `cat/head/tail/wc` без проверки аргументов:
```typescript
const READ_PROGRAMS = new Set(['ls', 'cat', 'head', 'tail', 'wc']);
...
if (READ_PROGRAMS.has(program)) return null;
```
Заменить: `[program, subcommand, ...args]` — subcommand тоже может быть путём, поэтому собирать `const operands = [subcommand, ...args].filter(a => a !== undefined && !a.startsWith('-'))`; для `cat/head/tail/wc` при секретном операнде → `deny(trimmed, 'чтение секретных файлов запрещено')`. Импортировать функцию из `./lib/secret-names.js` (та же, что в protect-files). `ls` оставить без проверки (имена, не содержимое). Метасимволы (`SHELL_METACHARS`) уже режут цепочки, поэтому достаточно первого сегмента.

---

### `.claude/settings.json` (mod; D-06, D-11)

**Analog:** сам файл, массивы `permissions.ask` / `deny` (строки 32-52):
```json
"ask": ["Bash(git push:*)", ...],
"deny": ["Read(./.env*)", "Edit(./.env*)", "Bash(cat .env*)", "Bash(head .env*)", "Bash(tail .env*)", ...]
```
Добавить:
- deny: `Read(**/.env*)` (рекурсивно), варианты `Bash(cat ./.env*)`, `Bash(less .env*)` и т.п. — синтаксис по документации установленной версии. Шаблоны `.env.example` не должны блокироваться: deny-глоб `.env*` их заденет — решение принять осознанно (второй слой, основной — hook) и зафиксировать в чек-листе.
- ask: `Edit(./.claude/**)`, `Write(./.claude/**)`. Проверить вручную в сессии, что `ask` перекрывает `defaultMode: acceptEdits`. Запомнить: hooks `PreToolUse` matcher `Edit|Write|Bash` (строка 56) уже вызывает `protect-files`; hook и permission-правила совместимы (hook `ask` + правило `ask`).
- Форматирование JSON — Prettier (2 пробела), как в файле.

---

### `.claude/agents/reviewer.md`

**Analog:** сам файл. frontmatter (строки 1-11) подключает `reviewer-readonly.ts` — менять нужно только если меняется путь/имя; иначе только проверить. `tools: Read, Grep, Glob, Bash` — инструмент `Read` у reviewer не закрыт hook'ом; закрывает deny в settings.json (D-06). В чек-листе отметить это явно.

---

### `tests/unit/protect-files.test.ts` (mod)

**Analog:** сам файл. Структура: `it.each([...])('blocks ...: %s', cmd => expect(checkBashCommand(cmd)).not.toBeNull())` и зеркальный `allows ...` список (строки 31-68). Имена тестов на английском, `root = '/home/user/library'`.

**Добавить:**
- blocks (чтение): `cat .env`, `cat ./.env`, `cat /home/user/library/.env`, `grep x .env`, `less .env`, `head -n 1 .env.local`, `tail .envrc`, `cd src && cat ../.env`.
- blocks (git add -f): `git add -f .env`, `git add --force .env.local`, `git add -fA .env`.
- allows: `grep -n '\.env' .planning/research/SUMMARY.md` (ложное срабатывание из D-10), `cat .env.example`, `cat .env.sample`, `cat .env.template`, `git add src/a.ts`, `git add .env.example`? (запись `.env.example` блокируется только для записи; для `git add` — решить явно и покрыть).
- ask (для `.claude/`): `sed -i s/a/b/ .claude/settings.json`, `echo x > .claude/hooks/x.ts`, `tee .claude/settings.json`, `cp a .claude/settings.json`; проверять `decision === 'ask'`, а `.env` в той же команде — `deny`.
- сохранить существующие кейсы без изменений (AGENTS.md запрещает ослаблять/переписывать тесты).
- TDD: сначала падающие тесты, затем реализация.

### `tests/unit/reviewer-readonly.test.ts` (mod)

**Analog:** сам файл (строки 5-37). В блок blocks добавить: `cat .env`, `cat ./.env.local`, `head -n 5 .env`, `tail .envrc`, `wc -l .env`, `cat docs/../.env`. В блок allows: `cat .env.example`, `cat README.md`, `head -n 5 package.json`.

---

### `docs/security-checklist.md` (NEW; doc)

**Analog:** таблицы `docs/about.md` (строки 12-22 «Роль | Выбор», 33-42 «Уровень | Файл | Сила | Что делает»): pipe-таблицы, выровненные Prettier, русский текст, имена файлов в обратных кавычках.

**Формат (D-14):** одна таблица со столбцами `Риск | Где закрыт (файл) | Команда проверки | Статус (закрыт / открыт) | Воспроизводим из git (да / нет)`; 8-12 строк (D-13). Команды проверки (D-15), пример: `npx vitest run tests/unit/protect-files.test.ts -t "blocks"`; для permissions — `grep -n '".env' .claude/settings.json` или ручной шаг («попросить агента выполнить `cat ./.env`»). Строка про `gsd-secret-read-guard`: статус «закрыт частично», воспроизводим «нет», ложные срабатывания (D-10). Остальные находки (`0.0.0.0`, нет авторизации, лимиты ввода, коммит в `main`, `npx -y` в `.mcp.json`, fail-open hooks, широкие allow SEC-04) — «открыт». Файл проходит Prettier (в отличие от `.planning/`): запустить `npm run format`.

---

### Документы (D-01..D-04)

- `CLAUDE.md`: строка `@docs/plan.md` → `@.planning/STATE.md` (D-02); строка «Текущий план и прогресс:» оставить.
- `AGENTS.md` строка 9 («план и roadmap — в `docs/plan.md`») и строка 72 («отмечать прогресс в `docs/plan.md`») → `.planning/ROADMAP.md`/`STATE.md` (D-03). Правка согласована автором.
- `docs/plan.md`: раздел «Модуль 2» (с заголовка `## Модуль 2: агентно-ориентированный пайплайн`) и `## Roadmap (следующие модули)` заменить ссылками; разделы ДЗ-1 не менять (D-01, D-04). Заголовки и ссылки из README/about.md не ломать.
- `.planning/PROJECT.md`: перенести буллеты Roadmap в раздел `### Out of Scope` (строка 42; формат буллетов «- Что — причина»). Файл вне Prettier.
- `docs/memory.md`: новая запись СВЕРХУ (после строки 5, перед `## 2026-10-22 — Модуль 2, шаг 1б ...`), формат заголовка `## ДАТА — Модуль 2, фаза 1: <тема> (ветка `feat/module-2`)` и четыре жирных абзаца **Сделано. / Решение. / Дальше. / Ловушки.** Ловушки должны включать D-10 (GSD-guard вне git, ложное срабатывание).

## Shared Patterns

### Hook-каркас (все hooks)
**Source:** `.claude/hooks/lib/hook-input.ts` + `protect-files.ts` 56-68. Чистая экспортируемая функция проверки, `isMain(import.meta.url)`-запуск, `try/catch` с отказом при ошибке разбора. Импорты с `.js`-суффиксом, комментарии на русском.

### Разбор Bash
**Source:** `parseShell` (`.claude/hooks/lib/shell.ts` 107-129) возвращает `{ words, writeTargets }[]`. Ограничения: `$VAR`/`$(...)` не раскрываются — тесты не должны обещать их покрытие; в чек-листе формулировать как «эвристика, не песочница» (`docs/about.md`).

### Единое определение секретного имени
**Source:** новый `.claude/hooks/lib/secret-names.ts`; использовать и в `protect-files.ts`, и в `reviewer-readonly.ts` (D-07).

### Тесты hooks
**Source:** `tests/unit/protect-files.test.ts` — `it.each` со списками blocks/allows, вызов функции напрямую, импорт `../../.claude/hooks/<file>.js`. Тест на каждый обход и ложное срабатывание (D-05).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| вывод `permissionDecision: "ask"` | hook output | request-response | Все существующие hooks используют только exit code 2 (`exitWithFeedback`); JSON-вывод на stdout — новый паттерн, формат брать из документации Claude Code |
| `docs/security-checklist.md` | doc | — | Аналога по содержимому нет, только по форме таблиц (`docs/about.md`) |
| `.claude/hooks/gsd-secret-read-guard.js` | справочник | — | Вне git: только как источник списка шаблонов (`.env.example/.sample/.template`; `.dist` в нём тоже есть, но D-08 его не включает) |

## Metadata

**Analog search scope:** `.claude/hooks/`, `.claude/hooks/lib/`, `.claude/agents/`, `.claude/settings.json`, `tests/unit/`, `docs/`, `.planning/PROJECT.md`
**Files scanned:** ~17 (прочитано полностью: 7)
**Pattern extraction date:** 2026-10-24
