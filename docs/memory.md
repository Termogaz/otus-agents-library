# Память проекта

Журнал сессий и шагов: что сделано, какие решения приняты, что дальше, на чём споткнулись.
Новые записи — сверху. Формат записи: **Сделано / Решение / Дальше / Ловушки**.

## 2026-10-18 — Шаг 0.3a: доменные правила выдачи (ветка `feat/domain`)

**Сделано.** `src/domain/types.ts` содержит `Book`, `Reader`, `Loan`, `LoanPolicy`, `LoanResult`.
`src/domain/loans.ts` содержит `checkoutBook`, `returnBook`, `isOverdue` и `DEFAULT_LOAN_POLICY`
(лимит 3, срок 14 дней). Работа по TDD через skill `write-tests`, агент вызвал его сам: 17 тестов
в `tests/unit/loans.test.ts`, сначала все красные (заглушки), потом зелёные. `npm run check` зелёный.

**Решение.** Отказы — `{ ok: false, code }`, коды: `NO_FREE_COPIES`, `LOAN_LIMIT_REACHED`,
`LOAN_ALREADY_RETURNED`. Если нарушены оба правила, отдаём `NO_FREE_COPIES`: это свойство книги,
а не читателя. `loanId` и `now` передаются параметром: домен не генерирует id и не берёт время.
Срок возврата — `issuedAt + loanDays × 24 ч`. Просрочка — строго позже `dueAt`, только у
невозвращённой книги. `checkoutBook` получает `loans` и сам отбрасывает возвращённые, поэтому
server может передать все выдачи книги и читателя.

**Дальше.** В новой сессии: 0.3b (репозиторий и JSON-файл) и 0.3c (API). Там же проверить rule
«в своей папке / в соседней»: сначала правка в `src/server/`, потом в `src/domain/`.

**Ловушки.** В этой сессии rule `domain.md` прочитан через `cat` до правок, поэтому проверка
загрузки rule здесь нечестная. Линтер-hook ошибок не нашёл, поэтому его срабатывание в 0.3a
не видно. Даты в домене — `Date`: при сохранении в JSON их надо превращать в ISO-строки и обратно.

## 2026-10-18 — Шаг 4: проверка hook'а `reviewer` в новой сессии (ветка `feat/hooks`)

**Сделано.** Агент `reviewer` вызван напрямую. `git status --short` прошёл. `touch hook-probe.txt`
заблокирован hook'ом `reviewer-readonly` («команды нет в белом списке»), файл не создан. Ловушка
прошлой записи подтверждена: hook из frontmatter агента начинает работать только в новой сессии.

**Решение.** Белый список не расширяем без согласования. Поддержку `git -C <путь>` пока не добавляем.

**Дальше.** PR `feat/hooks`, затем шаг 0.3.

**Ловушки.** Белый список сверяет начало строки команды. Поэтому `git -C /home/.../library status --short`
получает отказ, хотя только читает. Агенты склонны писать абсолютные пути, и reviewer будет получать
лишние отказы. Защиту это не ослабляет. Если мешает, разрешить `git -C <путь> <разрешённая подкоманда>`
с тестом.

## 2026-10-18 — Шаг 4: hooks (ветка `feat/hooks`)

**Сделано.** Три hook'а на TypeScript в `.claude/hooks/`, общий разбор shell — `lib/shell.ts`.
`protect-files` (PreToolUse `Edit|Write|Bash`) блокирует запись в `.env*`, `.git/`, `package-lock.json`,
включая `>`, `sed -i`, `tee`, `rm`, `mv`, `cp`. `format-and-lint` (PostToolUse `Edit|Write`) запускает
Prettier и ESLint, ошибки ESLint возвращает агенту кодом 2. `reviewer-readonly` подключён во frontmatter
`reviewer.md` и пропускает только белый список (`git status/diff/log/show`, просмотр веток, `npm run check`,
e2e, `ls/cat/head/tail/wc`). Логика — чистые функции, тесты в `tests/unit/` по TDD.
Проверено в сессии: `echo > .env` и `sed -i package-lock.json` заблокированы hook'ом; неотформатированный
`.ts` переформатирован, ошибка `no-unused-vars` пришла агенту.

**Решение.** Hooks на TS запускаются через `node_modules/.bin/tsx`: Node в WSL собран без поддержки
TypeScript (`ERR_NO_TYPESCRIPT`), а `tsx` уже есть в devDependencies. `tsconfig.json` расширен
(`include` += `.claude/hooks`), правила не ослаблены. Вход hook'а проверяется zod. При ошибке разбора
PreToolUse-hook'и отказывают (fail closed).

**Дальше.** Проверить hook `reviewer` в новой сессии, затем PR `feat/hooks`. После — шаг 0.3.

**Ловушки.** Hook во frontmatter `reviewer` в той же сессии, где его добавили, не сработал: `touch`
прошёл, хотя скрипт вручную отказывает (код 2). Вероятно, определения агентов читаются при старте
сессии — проверять в новой. Первая версия `protect-files` ложно сработала на тело heredoc (текст
`echo > .env` внутри `python3 - <<'EOF'`) — тела heredoc теперь вырезаются, есть тесты.
Без `npm ci` hooks не запустятся: ошибка запуска (не код 2) не блокирует вызов, защита молча пропадёт.
Bash-разбор — эвристика: `$VAR`, `$(...)`, `python -c` не раскрываются. Порядок: сначала `deny`
из permissions, потом hook — Write в `.env*` режет уже permissions.

## 2026-10-18 — Шаг 3: permissions (ветка `feat/permissions`)

**Сделано.** В `.claude/settings.json` — `permissions`: allow для проверок (`npm run check`,
`test`, `lint`, `typecheck`, `format`, `npx vitest run`, e2e) и read-only git; ask для `git push`,
`gh pr create/merge`, `npm install`; deny для `.env*` (Read, Edit, `cat`), `Edit(package-lock.json)`,
`rm -rf`, `git push --force`/`-f`, `git push origin main`, `npm publish`. Режим по умолчанию — `acceptEdits`.
Проверено в сессии: `cat .env`, `Read(.env)`, `git push --force` блокируются.

**Решение.** `acceptEdits`: правки файлов откатываются через git и проходят `/review-step`, а Bash
остаётся под allow / ask / deny. Read-only для `reviewer` permissions не решить — правила общие для
сессии и subagent'ов; переносим на шаг 4 (hook во frontmatter агента).

**Дальше.** Шаг 4 — hooks: линтер/форматтер после правки, блокировка защищённых файлов, read-only `reviewer`.

**Ловушки.** Bash-правила — префиксы строки команды, не песочница: `git push origin HEAD:main`,
`less .env` или `rm -r -f` их обходят. Это закрывает (частично) hook на шаге 4 и фиксируется в
`docs/about.md`. Правила для файлов — `Edit(...)` покрывает и Write; пути `./` — от корня проекта.

## 2026-10-17 — Шаг 2: rules и skills (ветка `feat/skills`)

**Сделано.** Rules с `paths:` для `src/domain/` и `tests/e2e/`. Skills `write-tests`
(агент вызывает сам при правках домена и API) и `review-step` (только вручную,
`disable-model-invocation`), который работает в `context: fork` через subagent `reviewer`.
Первый прогон `/review-step`: блокеров нет, 6 замечаний, исправлены в этой же ветке —
`docs/memory.md` заведён, в чек-лист добавлены пункты про память и имя ветки,
в `allowed-tools` — `git show` и `git branch`, план уточнён.

**Решение.** `docs/memory.md` ведём с шага 2, не ждём шага 4: правило из `AGENTS.md`
действует с самого начала, записи за шаги 0–1 восстановлены задним числом.
Дыру «read-only `reviewer` держится только на промпте» закрываем на шаге 3/4.

**Дальше.** Merge PR `feat/skills`. Затем шаг 3 — permissions allow / ask / deny,
режим по умолчанию, `settings.local.json` в `.gitignore`.

**Ловушки.** У `reviewer` открыт весь `Bash`: при прямом вызове агента (не через skill)
`allowed-tools` skill'а не действуют. Проверка rule «в своей папке / в соседней» — только
в новой сессии, иначе rule уже загружен в контекст.

## 2026-10-17 — Шаги 0–1: проект, каркас, `AGENTS.md`

**Сделано.** Выбран проект (библиотека) и стек (fullstack TypeScript). `git init`,
репозиторий `Termogaz/otus-agents-library` (временно private). Каркас: Express 5, React/Vite,
Vitest, ESLint, Prettier. `AGENTS.md` с четырьмя разделами, `CLAUDE.md` ссылается на него
через `@AGENTS.md`.

**Решение.** MVP-домен пишем после настройки среды (шаг 0.3 после шагов 2–4), чтобы он
демонстрировал rules, skills, hooks и память. Проект — в файловой системе WSL, не на `/mnt/c`.

**Дальше.** Шаг 2 — rules и skills.

**Ловушки.** npm через локальный прокси падает с `ECONNRESET`; e2e с прокси — таймаут
`webServer`. Лечится запуском через `env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY`.
Chromium для Playwright в WSL требует `npx playwright install-deps chromium`.
