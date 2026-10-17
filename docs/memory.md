# Память проекта

Журнал сессий и шагов: что сделано, какие решения приняты, что дальше, на чём споткнулись.
Новые записи — сверху. Формат записи: **Сделано / Решение / Дальше / Ловушки**.

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
