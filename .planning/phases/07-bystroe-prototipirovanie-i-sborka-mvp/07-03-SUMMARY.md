---
phase: 07-bystroe-prototipirovanie-i-sborka-mvp
plan: 03
subsystem: docker-deploy
tags: [docker, nginx, tsc, seed, playwright-config]
status: complete

requires:
  - phase: 07-bystroe-prototipirovanie-i-sborka-mvp
    provides: "07-01 (vite build в dist/client, три страницы), 07-10 (lockfile с пакетами фазы), 07-02 (демо-адаптер)"
provides:
  - "tsconfig.server.json: tsc собирает src/server и src/domain в dist/api, запуск node dist/api/server/index.js без tsx"
  - "data/seed.json: 6 демо-книг и 4 демо-читателя без выдач в формате хранилища версии 1"
  - "Dockerfile (build, api, web), docker-compose.yml (api без портов, web на 8080, том library-data), docker/nginx.conf, .dockerignore"
  - "playwright.docker.config.ts: e2e на контейнере или публичной ссылке через E2E_BASE_URL"
affects: [07-08, 07-09]

actuals:
  tokens: 2600
  tasks: 2
  commits: 2

plan_head_before: cbc4c36c7bf43e871e46c43b9b1af4c932ba3877
plan_head_after: c6e17ecb25f02fca3785425b536bafb7df334f63
commits: 2

tech-stack:
  added: []
  patterns:
    - "Контекст сборки целиком копируется только в стадию build; api и web берут из неё dist/api и dist/client"
    - "CMD api в одну строку sh -c: семя копируется в том, только если library.json нет (без shell-скрипта из-за CRLF)"
    - "nosniff повторён в каждом location с собственным add_header (nginx не наследует заголовок уровня server)"

key-files:
  created:
    - tsconfig.server.json
    - data/seed.json
    - tests/unit/seed.test.ts
    - Dockerfile
    - docker-compose.yml
    - docker/nginx.conf
    - .dockerignore
    - playwright.docker.config.ts
  modified: []

key-decisions:
  - "Относительные импорты server и domain уже с .js (проверено, 0 без расширения): сборка tsc без правки кода"
  - "Семя без выдач (Q4): сроки выдач устарели бы сразу; формат data/library.json не менялся"

requirements-completed: [HW4-4]

coverage:
  - id: D1
    description: "Сервер собирается tsc и запускается node без tsx, отдаёт книги из семени"
    requirement: HW4-4
    verification:
      - kind: command
        ref: "npx tsc -p tsconfig.server.json; сборка createApp на копии семени: книг 6 health ok; node dist/api/server/index.js на PORT=3917: entry книг 6"
        status: pass
    human_judgment: false
  - id: D2
    description: "Семя читается JsonFileRepository в текущем формате, без выдач и реальных данных"
    requirement: HW4-4
    verification:
      - kind: unit
        ref: "tests/unit/seed.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Compose: api без опубликованных портов, web на 8080 с зависимостью по healthcheck, том library-data"
    requirement: HW4-4
    verification:
      - kind: command
        ref: "docker compose config --format json: compose ok"
        status: pass
    human_judgment: false
  - id: D4
    description: "Сборка образов и работа nginx (404 без подмены, nosniff, прокси /api/, редирект /v2 на /v2/) в контейнерах"
    requirement: HW4-4
    human_judgment: true
    rationale: "Демон Docker не запущен: docker build и docker compose up не выполнялись; сквозная проверка — контрольная точка автора в 07-08"
---

# Phase 7 Plan 03: Docker, nginx и семя Summary

Сервер собирается `tsc -p tsconfig.server.json` в `dist/api` и стартует `node dist/api/server/index.js` без `tsx`; в Docker описаны два контейнера (nginx со статикой и прокси `/api/`, Node с томом данных и стартовым семенем).

## Выполнено

- **Task 1 (tracer), 2492d4e.** Сначала `tests/unit/seed.test.ts` (4 теста, красные без семени), затем `data/seed.json` (6 книг «Демо-книга …», одна с одним экземпляром, 4 читателя `…@example.test`, `loans: []`) и `tsconfig.server.json` (`extends` на корневой конфиг, `noEmit: false`, `outDir: dist/api`, `rootDir: src`, строгость не ослаблялась).
- **Task 2, c6e17ec.** `Dockerfile` из трёх стадий (`build`, `api` с `USER node`, `web` на nginx), `docker-compose.yml`, `docker/nginx.conf`, `.dockerignore`, `playwright.docker.config.ts` (базовый конфиг без `webServer`, `baseURL` из `E2E_BASE_URL`, запасной `http://localhost:8080`).

## Вывод собранного сервера (acceptance Task 1)

```text
книг 6 health ok
API: http://localhost:3917   (node dist/api/server/index.js, PORT и LIBRARY_DATA_FILE из окружения)
entry книг 6
```

`git status --porcelain -uall data/`: только `?? data/seed.json`, рабочий `data/library.json` в git не попадает.

## Проверки

- `docker compose config -q`: код 0 (работает без демона); JSON-проверка: `compose ok` (у `api` нет `ports`, у `web` 8080, `service_healthy`, том `library-data`).
- grep: `USER node` 1, `npm ci --omit=dev` 1, `absolute_redirect off` 1, `client_max_body_size 1m` 1, nosniff с `always` 3, правила `.env*` в `.dockerignore` 3, `!data/seed.json` 1.
- `COPY . .` только в стадии `build` (строка 8); `CMD` api копирует семя под условием `[ -f "$LIBRARY_DATA_FILE" ] ||`.
- `npm run typecheck`, `npm run lint`, `npm run format:check`: чисто. Полный Vitest: 593 теста, один красный, известный `format-and-lint hook script formats edited file in place with exit code 0` (D-16).
- FREEZE (`git diff --exit-code main -- src/client index.html tests/e2e/loans.spec.ts tests/e2e/smoke.spec.ts`): код 0.

## Что не запускалось

Сборка образов не запускалась: демон Docker не работает (`docker build` и `docker compose up` не вызывались). Проверяется у автора в 07-08: `docker compose up --build`, 404 на несуществующий путь, редирект `/v2` на `/v2/`, заголовок `X-Content-Type-Options`, том сохраняется после перезапуска. Известный риск без проверки: `package-lock.json`, созданный на Windows, может не содержать нативных сборок для linux-musl (Rollup, Tailwind oxide, lightningcss); проявится на `npm ci` в стадии `build`. Lockfile не правился.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. T-07-05 (`.dockerignore` исключает `.env*`, `.claude`, `.planning`, `.local`, `.git`), T-07-06 (у `api` нет `ports`), T-07-07 (`USER node`), T-07-08 (`client_max_body_size 1m`), T-07-09 (nosniff в каждом `location`, 404 без подмены), T-07-10 (семя только в пустой том) отражены в конфигах; проверка контейнеров — у автора в 07-08.

## Self-Check: PASSED

- FOUND: tsconfig.server.json, data/seed.json, tests/unit/seed.test.ts, Dockerfile, docker-compose.yml, docker/nginx.conf, .dockerignore, playwright.docker.config.ts
- FOUND commits: 2492d4e, c6e17ec
