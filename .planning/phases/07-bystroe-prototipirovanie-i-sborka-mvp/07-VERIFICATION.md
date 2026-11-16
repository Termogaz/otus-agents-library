---
phase: 07-bystroe-prototipirovanie-i-sborka-mvp
verified: 2026-11-16T17:15:00Z
status: human_needed
score: 3/7 must-haves verified
covered_files: [".dockerignore",".planning/phases/07-bystroe-prototipirovanie-i-sborka-mvp/07-01-PLAN.md",".planning/phases/07-bystroe-prototipirovanie-i-sborka-mvp/07-01-SUMMARY.md",".planning/phases/07-bystroe-prototipirovanie-i-sborka-mvp/07-02-PLAN.md",".planning/phases/07-bystroe-prototipirovanie-i-sborka-mvp/07-02-SUMMARY.md",".planning/phases/07-bystroe-prototipirovanie-i-sborka-mvp/07-03-PLAN.md",".planning/phases/07-bystroe-prototipirovanie-i-sborka-mvp/07-03-SUMMARY.md",".planning/phases/07-bystroe-prototipirovanie-i-sborka-mvp/07-04-PLAN.md",".planning/phases/07-bystroe-prototipirovanie-i-sborka-mvp/07-04-SUMMARY.md",".planning/phases/07-bystroe-prototipirovanie-i-sborka-mvp/07-05-PLAN.md",".planning/phases/07-bystroe-prototipirovanie-i-sborka-mvp/07-05-SUMMARY.md",".planning/phases/07-bystroe-prototipirovanie-i-sborka-mvp/07-06-PLAN.md",".planning/phases/07-bystroe-prototipirovanie-i-sborka-mvp/07-06-SUMMARY.md",".planning/phases/07-bystroe-prototipirovanie-i-sborka-mvp/07-07-PLAN.md",".planning/phases/07-bystroe-prototipirovanie-i-sborka-mvp/07-07-SUMMARY.md",".planning/phases/07-bystroe-prototipirovanie-i-sborka-mvp/07-08-PLAN.md",".planning/phases/07-bystroe-prototipirovanie-i-sborka-mvp/07-08-SUMMARY.md",".planning/phases/07-bystroe-prototipirovanie-i-sborka-mvp/07-09-PLAN.md",".planning/phases/07-bystroe-prototipirovanie-i-sborka-mvp/07-09-SUMMARY.md",".planning/phases/07-bystroe-prototipirovanie-i-sborka-mvp/07-10-PLAN.md",".planning/phases/07-bystroe-prototipirovanie-i-sborka-mvp/07-10-SUMMARY.md","DESIGN.md","Dockerfile","README.md","components.json","data/seed.json","docker-compose.yml","docker/nginx.conf","package-lock.json","package.json","playwright.config.ts","playwright.docker.config.ts","prototype/index.html","src/client-v2/App.tsx","src/client-v2/components/ListState.tsx","src/client-v2/components/StatusMessage.tsx","src/client-v2/components/VariantFooter.tsx","src/client-v2/components/ui/alert.tsx","src/client-v2/components/ui/button.tsx","src/client-v2/components/ui/card.tsx","src/client-v2/components/ui/input.tsx","src/client-v2/components/ui/label.tsx","src/client-v2/components/ui/native-select.tsx","src/client-v2/components/ui/table.tsx","src/client-v2/demo/demo-api.ts","src/client-v2/demo/demo-data.ts","src/client-v2/features/BooksSection.tsx","src/client-v2/features/LoansSection.tsx","src/client-v2/features/ReadersSection.tsx","src/client-v2/lib/utils.ts","src/client-v2/loan-view.ts","src/client-v2/prototype/PrototypeBar.tsx","src/client-v2/prototype/main.tsx","src/client-v2/prototype/scenarios.ts","src/client-v2/styles.css","src/client-v2/use-busy.ts","src/client-v2/v2/main.tsx","src/client-v2/vite-env.d.ts","src/client/App.tsx","tests/e2e/fake-api.ts","tests/e2e/hw4-screenshots.spec.ts","tests/e2e/prototype.spec.ts","tests/e2e/release-checklist.spec.ts","tests/e2e/v2-hints.spec.ts","tests/e2e/v2-layout.spec.ts","tests/e2e/v2-lists.spec.ts","tests/e2e/v2-lock.spec.ts","tests/e2e/v2-main-flow.spec.ts","tests/e2e/v2-motion.spec.ts","tests/e2e/v2-outcome.spec.ts","tests/e2e/v2-shell.spec.ts","tests/e2e/variant-links.spec.ts","tests/unit/client-v2-layers.test.ts","tests/unit/css-tokens.test.ts","tests/unit/demo-api.test.ts","tests/unit/loan-view.test.ts","tests/unit/prototype-scenarios.test.ts","tests/unit/seed.test.ts","tsconfig.json","tsconfig.server.json","v2/index.html","vite.config.ts"]
covered_digest: "v3:sha256:8be439ffcef544761e3c900db204f01d1a2bf90dbf729e98003ebe3d95e3d0db"
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "Есть публичная ссылка на Vercel или TimeWeb Cloud, по ней проходит чек-лист перед показом"
    reason: "Собственный VPS (Play2Go) с Docker Compose и Caddy: MVP нужен постоянный диск (D-14); выбор площадки за автором (D-15); отклонение и причина для обеих площадок раскрыты в README «Принятый риск»"
    accepted_by: "автор (ответ «Accept the deviation»)"
    accepted_at: "2026-11-16T18:00:00Z"
gaps:
  - truth: "SC-6: Есть публичная ссылка на Vercel или TimeWeb Cloud, по ней проходит чек-лист перед показом (пункт 4 ДЗ)"
    status: partial
    reason: >-
      Публичная HTTPS-ссылка есть и чек-лист D-13 на ней проходит (перепроверено: 5 passed), но площадка —
      собственный VPS у Play2Go, а не Vercel или TimeWeb Cloud. Отклонение записано в README («Принятый риск») и
      в 07-09-SUMMARY как решение автора, но override в VERIFICATION.md нет, а обоснование в README объясняет
      только отказ от статического хостинга (Vercel); почему не TimeWeb Cloud (там есть облачные серверы и
      Docker-приложения с постоянным диском) — не сказано.
    artifacts:
      - path: "README.md"
        issue: "«Принятый риск»: причина «статический хостинг для /v2/ не подходит» не покрывает TimeWeb Cloud; D-15 предлагал TimeWeb для Docker и Vercel для прототипа"
    missing:
      - "Решение автора: принять отклонение — добавить override в frontmatter этого файла (шаблон в разделе «Gaps Summary») и переверифицировать; либо выложить хотя бы прототип на Vercel / приложение на TimeWeb Cloud"
      - "Одна фраза в README «Принятый риск»: почему не TimeWeb Cloud (например, учебный VPS уже был / цена / РФ-регистрация) — чтобы проверяющий видел причину для обеих названных площадок"
behavior_unverified_items:
  - truth: "SC-3: /v2/ — MVP на настоящем API, FR-1..FR-6 закрыты e2e"
    test: "В WSL (env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY) выполнить `npm run test:e2e` один раз на HEAD da856a3"
    expected: "66 passed (14 файлов), в том числе v2-outcome, v2-lock, v2-lists, v2-hints, v2-layout, v2-motion, v2-main-flow"
    why_human: "Полный e2e поднимает dev-сервер и пишет в data/library.json — верификатору запрещено; последний полный прогон 66/66 в 07-08-SUMMARY записан «по отчёту предыдущего исполнителя, не перепроверялось», 07-09 e2e не запускал"
  - truth: "SC-7 (часть): `npm run test:e2e` зелёный"
    test: "Тот же прогон `npm run test:e2e`, что выше"
    expected: "Все 66 тестов зелёные, включая неизменённые loans.spec.ts и smoke.spec.ts"
    why_human: "Не запускался верификатором (запись состояния, свой сервер); свидетельство только в SUMMARY"
human_verification:
  - test: "Полный `npm run test:e2e` в WSL на HEAD"
    expected: "66 passed"
    why_human: "Требует запуска dev-сервера и записи в data/library.json"
  - test: "Docker локально (07-08 Task 3, шаги 2, 3, 4, 6): nginx -t; curl /v2/ 200 + nosniff, /nope 404; smoke + v2-main-flow + release-checklist против http://localhost:8080; данные переживают `docker compose restart`"
    expected: "Все шаги зелёные"
    why_human: "Подтверждено автором ответом «docker ok» без вывода (человеческая проверка, выполнена); верификатор Docker не запускал. Шаг 5 (release-checklist на 8080) автор сообщил «5 passed». Шаг 7 (seed в пустой том через down -v) автор не сообщал — косвенно подтверждён публичным API (см. отчёт)"
  - test: "Развёртывание на VPS (07-09 Task 2): docker compose ps, конфиг Caddy"
    expected: "api healthy, web на 127.0.0.1:8080, Caddy reverse_proxy с HTTPS"
    why_human: "Подтверждено автором «сайт развернут, все ок» (человеческая проверка, выполнена); снаружи верификатор подтвердил: 200 на /, /v2/, /prototype/, /api/health, 404 на несуществующий путь, 308 http→https, порты 8080 и 3000 не отвечают"
  - test: "Judgment-tier запреты планов (prohibitions), см. раздел «Prohibitions»"
    expected: "Автор подтверждает LLM-вердикт по каждому"
    why_human: "Запреты типа judgment: вердикт верификатора не авторитетен"
---

# Phase 7: Быстрое прототипирование и сборка MVP — Verification Report

**Phase Goal:** У библиотеки есть второй вариант интерфейса на библиотеках курса: кликабельный прототип на демо-данных и MVP на настоящем API; текущий интерфейс и его e2e не меняются; приложение собирается в Docker с nginx и доступно по публичной ссылке (`docs/homework-4.md`).
**Verified:** 2026-11-16T17:15:00Z
**Status:** gaps_found (один пробел — площадка хостинга без override; остальное — человеческие проверки)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `DESIGN.md` сопоставляет токены с shadcn/ui и содержит исключение про анимации в `/prototype/` и `/v2/` (п. 1 ДЗ) | ✓ VERIFIED | `DESIGN.md:76` «Соответствие токенам shadcn/ui» (14 пар), `:199` исключение D-07 (150–300 мс, reduce → 0), `:274` «История изменений». `src/client-v2/styles.css` — `@theme` + `@theme inline`; `tests/unit/css-tokens.test.ts` зелёный в общем прогоне |
| 2 | `/prototype/` — кликабельный прототип на Tailwind + shadcn с демо-данными в памяти, без API, основной сценарий, восемь состояний (п. 2 ДЗ) | ✓ VERIFIED | `prototype/index.html` → `src/client-v2/prototype/main.tsx` → `createDemoApi(scenarioOptions(hash))` + тот же `App` (`mode="demo"`); в `demo/` и `prototype/` нет `fetch` и `/api`; `demo-api.test.ts`, `prototype-scenarios.test.ts` зелёные; 8 снимков `hw4-prototype-*.png` в git (просмотрен «отказ»: alert «Нет свободных экземпляров», только «Демо-…»); публичный `/prototype/`: чек-лист 5/5 (статус «API: демо-данные», нет ответов ≥400). Деплойный бандл прототипа побайтно совпадает с локальной сборкой HEAD (кроме имени CSS-чанка) |
| 3 | `/v2/` — MVP на тех же компонентах и настоящем API: FR-1..FR-6 закрыты e2e, цвета только из токенов, 390 px без горизонтальной прокрутки (п. 3 ДЗ) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Код и wiring есть: `v2/main.tsx` → `App({api, mode:"server"})` из `src/client/api.ts`; `StatusMessage` alert/status (D-12), `use-busy.ts` (FR-3), `loan-view.ts` (FR-4, просрочка из поля `overdue`), подсказки FR-6 без блокировки. E2E существуют (перечислены `playwright test --list`: v2-outcome 9, v2-lock 5, v2-lists 8, v2-hints 5, v2-layout 7, v2-motion 4, v2-main-flow 1). Токены — unit зелёный; 375 px без прокрутки — перепроверено на публичном адресе. Но сами FR-e2e верификатор не запускал (нужен dev-сервер и запись данных), последний полный прогон — только в SUMMARY |
| 4 | Текущий `/` работает как раньше: `loans.spec.ts`, `smoke.spec.ts` без правок; ссылки переключения между вариантами | ✓ VERIFIED | `git diff main...HEAD -- src/client index.html tests/e2e/loans.spec.ts tests/e2e/smoke.spec.ts`: только +6 строк подвала в `src/client/App.tsx` (`/v2/`, `/prototype/`); `src/domain`, `src/server` не менялись; `tsconfig.json` — только `paths`. `VariantFooter.tsx` в `App` для `/v2/` и `/prototype/`; `variant-links.spec.ts` (4 теста); публичный `/`: заголовок «Библиотека», «API: ok», без ошибок консоли. Прогон loans/smoke — в human-пункте полного e2e |
| 5 | `docker compose up` поднимает nginx со статикой и прокси `/api` в Node; данные на томе; пустой том получает демо-данные; основной сценарий e2e проходит на адресе контейнера | ? UNCERTAIN (human-confirmed) | Файлы проверены: `Dockerfile` (build/api/web, `USER node`, `CMD` копирует seed только при отсутствии файла), `docker-compose.yml` (том `library-data`, healthcheck `/api/health`, `web` на `127.0.0.1:8080`, у `api` портов нет), `docker/nginx.conf` (proxy_pass `http://api:3000`, `=404` без подмены, nosniff `always` во всех location), `.dockerignore` (`.env*`, `data/*` кроме seed), `tsconfig.server.json`, `seed.test.ts` зелёный. На проде (тот же compose со слов автора): 404 на несуществующий путь, nosniff есть, `/api/books` = ровно 6 книг seed, `/api/readers` = 4, `/api/loans` = [] — seed попал в пустой том. Сборка образа, переживание `restart`, `v2-main-flow` на 8080 — только «docker ok» автора (человеческая проверка без вывода) |
| 6 | Публичная ссылка на Vercel или TimeWeb Cloud, по ней проходит чек-лист перед показом (п. 4 ДЗ) | ✗ FAILED (partial, override предложен) | Ссылка https://otus-ai.silentharbor.ru/ работает, HTTPS, чек-лист перепроверен: **5 passed** (`E2E_REAL_FONT=1`). Деплой совпадает с HEAD (JS-чанки идентичны локальной сборке). Но площадка — собственный VPS у Play2Go, а не Vercel/TimeWeb Cloud; override нет. См. «Gaps Summary» |
| 7 | README «Модуль 4» с таблицей «пункт ДЗ → артефакт → команда → скриншот → ссылка»; `npm run check` и `npm run test:e2e` зелёные | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Таблица есть, все 30 относительных ссылок раздела существуют и в git (17 снимков `hw4-*.png`, 8 артефактов, каталоги), публичные ссылки отвечают 200. `typecheck`, `lint`, `format:check` зелёные; Vitest 605/606, единственный красный — известный `format-and-lint ... exit code 0` (D-16). `npm run test:e2e` не перепроверен (human-пункт) |

**Score:** 3/7 truths verified (2 present, behavior-unverified; 1 uncertain с человеческим подтверждением; 1 failed — платформа хостинга)

### Must-haves планов (сводно)

| План | Ключевые truths | Status | Evidence |
|------|-----------------|--------|----------|
| 07-01 | 3 страницы Vite, appType mpa, `src/client-v2`, токены в `@theme`, css-tokens тест, заморозка `/` | ✓ | `vite.config.ts` (input main/v2/prototype, `appType: 'mpa'`, alias `@`), unit зелёный, freeze diff |
| 07-10 | shadcn radix-nova на токенах, Geist удалён, motion 14.14.0, 7 компонентов, таблица соответствия | ✓ | `package.json` +9 зависимостей ровно из согласованного списка, Geist нет, `components/ui/*` 7 файлов, `DESIGN.md:76` |
| 07-02 | `createDemoApi` повторяет `api`, «Демо-»/`@example.test`, ApiError-коды, домен только из `demo/` | ✓ | `demo-api.test.ts`, `client-v2-layers.test.ts` зелёные; grep: `../../domain` импортирует только `demo/demo-api.ts` |
| 07-03 | tsc → `dist/api`, seed без выдач, nginx 404 + nosniff, том, порт Node закрыт | ✓ (код) / human (запуск) | файлы и публичные заголовки; запуск образа — автор |
| 07-04 | отказ под кнопкой, один alert, итог FR-5, блокировка FR-3 | ⚠️ e2e не перепроверены | код + e2e-файлы есть |
| 07-05 | порядок/статусы FR-4, состояния загрузки FR-1, подсказки FR-6 | ⚠️ e2e не перепроверены | `loan-view.test.ts` зелёный; e2e-файлы есть |
| 07-06 | раскладка 360–1440, Motion без exit, reduce → 0, подвал на всех страницах | ✓ / ⚠️ | `LazyMotion strict` + `MotionConfig reducedMotion="user"` в `App.tsx`, нет `AnimatePresence`/`exit`; 375 px на проде перепроверено; прочие e2e не перепроверены |
| 07-07 | прототип без `/api`, 8 состояний по хешу, снимки на демо-данных | ✓ | см. SC-2 |
| 07-08 | чек-лист D-13 для любого `E2E_BASE_URL`, main-flow на сервере, снимки, Docker автором | ✓ / human | `release-checklist.spec.ts` (только GET-навигация), перепроверен на проде; Docker — «docker ok» |
| 07-09 | публичная HTTPS-ссылка, чек-лист с настоящими шрифтами, README «Модуль 4», библиотеки и отказы D-06 | ✓ кроме платформы | README: взятые (Tailwind 4.3.5, shadcn, lucide, Motion 14.14.0, 21st.dev только просмотр) и отказ TailArk/GSAP/Design OS/UI-UX Pro Max по строке |

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `src/client-v2/styles.css` | ✓ VERIFIED | `@theme` + `@theme inline`, dark-вариант отключён |
| `tests/unit/css-tokens.test.ts`, `client-v2-layers.test.ts`, `demo-api.test.ts`, `seed.test.ts`, `loan-view.test.ts`, `prototype-scenarios.test.ts` | ✓ VERIFIED | все зелёные в общем прогоне |
| `src/client-v2/demo/demo-api.ts`, `demo-data.ts` | ✓ VERIFIED | используются `prototype/main.tsx` |
| `src/client-v2/prototype/{main.tsx,scenarios.ts,PrototypeBar.tsx}` | ✓ VERIFIED | точка входа `prototype/index.html` |
| `src/client-v2/App.tsx`, `features/*`, `components/*` | ✓ VERIFIED (wired) | используются обеими точками входа |
| `Dockerfile`, `docker-compose.yml`, `docker/nginx.conf`, `.dockerignore`, `tsconfig.server.json`, `data/seed.json` | ✓ VERIFIED (статически + прод-заголовки) | запуск — автор |
| `playwright.docker.config.ts`, `tests/e2e/release-checklist.spec.ts` | ✓ VERIFIED | прогнан на проде: 5 passed |
| 14 e2e-файлов (66 тестов) | ✓ существуют | перечислены `--list`; прогон — human |
| 17 снимков `docs/screenshots/hw4-*.png` | ✓ VERIFIED | в git; просмотрены `hw4-public-v2-375.png`, `hw4-prototype-refusal.png` — настоящие кадры на демо-данных |
| `README.md` «Модуль 4» | ✓ VERIFIED | все ссылки разрешаются |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `v2/index.html` | `src/client-v2/v2/main.tsx` | script + `rolldownOptions.input.v2` | WIRED |
| `v2/main.tsx` | `src/client/api.ts` | `App api={api} mode="server"` | WIRED (подтверждено и в деплойном бандле) |
| `prototype/main.tsx` | `demo/demo-api.ts`, `App.tsx` | `createDemoApi(...)`, `key={scenario.name}`, `mode="demo"` | WIRED |
| `App.tsx` | `VariantFooter.tsx`, `StatusMessage.tsx`, motion | импорт + рендер, `LazyMotion`/`MotionConfig` в корне | WIRED |
| `src/client/App.tsx` | `/v2/`, `/prototype/` | ссылки со слэшем | WIRED |
| `docker-compose.yml` | `Dockerfile` | `build.target: api/web` | WIRED |
| `docker/nginx.conf` | `src/server/index.ts` | `proxy_pass http://api:3000`, `PORT`, `LIBRARY_DATA_FILE` из `ENV` | WIRED (прод: `/api/health` 200) |
| `Dockerfile` | `data/seed.json` | `COPY` в `/app/seed`, `CMD [ -f ] \|\| cp` | WIRED (прод = seed) |
| `README.md` | `docs/screenshots/hw4-*.png`, `release-checklist.spec.ts` | ссылки в таблице | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|----------|------|--------|-----------|--------|
| `/v2/` списки | books/readers/loans | `api.listBooks/listReaders/listLoans` → nginx → Express → `JsonFileRepository` на томе | да (прод `/api/books` = 6 книг seed) | ✓ FLOWING |
| `/prototype/` списки | то же | `createDemoApi` → `createDemoData(now)` в памяти | демо по замыслу (D-10) | ✓ FLOWING (демо) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Типы, линтер, формат | `npm run typecheck`, `npm run lint`, `npx prettier --check .` | без ошибок | ✓ PASS |
| Unit (один полный прогон) | `npx vitest run` | 605 passed, 1 failed — известный `format-and-lint ... exit code 0` (D-16) | ✓ PASS (по D-16) |
| Чек-лист D-13 на проде | `E2E_BASE_URL=https://otus-ai.silentharbor.ru E2E_REAL_FONT=1 npx playwright test -c playwright.docker.config.ts tests/e2e/release-checklist.spec.ts` | 5 passed (11.1 s) | ✓ PASS |
| Публичные адреса (GET/HEAD) | curl | `/`, `/v2/`, `/prototype/`, `/api/health`, `/api/books` 200; `/v2`, `/prototype` 301 → со слэшем; `/nonexistent-xyz` 404; `http://` 308 → https; `X-Content-Type-Options: nosniff`; `Server: Caddy` + `nginx/1.31.8` | ✓ PASS |
| Порт web/api не открыт наружу | `curl http://…:8080/`, `:3000/` | нет соединения | ✓ PASS |
| Деплой = HEAD | `vite build` в scratchpad, сравнение с `/assets/*` прода | `main`, `jsx-runtime` — те же хеши; `v2`, `prototype`, `styles-*.js` совпадают по содержимому; CSS локально больше из-за неотслеживаемых файлов в `docs/` (автодетект Tailwind) | ✓ PASS |
| Перечень e2e | `npx playwright test --list` | 66 тестов в 14 файлах | ✓ (существование) |

### Probe Execution

Step 7c: SKIPPED — фаза не объявляет `scripts/*/tests/probe-*.sh`.

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|-------------|-------------|--------|----------|
| HW4-1 (UX, UI) | 07-06, 07-09, 07-10 | ✓ SATISFIED | DESIGN.md, токены, снимки |
| HW4-2 (прототип на библиотеках) | 07-01, 07-02, 07-07, 07-09 | ✓ SATISFIED | `/prototype/`, Tailwind + shadcn + Motion |
| HW4-3 (MVP на библиотеках) | 07-01, 07-04..07-06, 07-09, 07-10 | ? NEEDS HUMAN (e2e) | код и деплой есть; FR-e2e не перепроверены |
| HW4-4 (хостинг Vercel/TimeWeb) | 07-03, 07-08, 07-09 | ✗ BLOCKED по букве / ✓ по сути | публичная ссылка работает, площадка другая, override нет |
| FR-1..FR-6, NFR-1, NFR-2 | 07-04..07-06 | ? NEEDS HUMAN | e2e существуют; NFR-1 на 375 px перепроверен на проде |

HW4-* в `.planning/REQUIREMENTS.md` нет (ROADMAP ссылается на пункты `docs/homework-4.md`) — не orphaned, просто вне таблицы требований.

### Prohibitions (judgment-tier, вердикт верификатора не авторитетен — human review recommended)

| Запрет | LLM-вердикт |
|--------|-------------|
| Пакеты только из согласованного списка, lockfile не вручную | соблюдён: +9 зависимостей ровно из списка CONTEXT/07-01; ручную правку lockfile проверить невозможно |
| Не менять `src/client/**`, `index.html`, loans/smoke e2e (кроме подвала); не ослаблять tsconfig | соблюдён (git diff) |
| Нет настоящих данных в демо и снимках | соблюдён (`seed.test.ts`, демо-тесты, просмотренные снимки) |
| Адаптер демо без сети | соблюдён (нет `fetch`/`/api` в `demo/`, `prototype/`) |
| Нет `.env*` в образе, порт Node не опубликован | соблюдён (`.dockerignore`, compose, прод :3000 закрыт) |
| Seed не перезаписывает существующий файл | соблюдён (`CMD [ -f ] \|\| cp`) |
| Клиент не решает выдачу и не считает просрочку | соблюдён (`loan-view.ts` только показ, `overdue` с сервера, «Выдать» блокируется только `busy`) |
| Нет анимации ухода для alert/status | соблюдён (нет `AnimatePresence`/`exit`) |
| Хостинг выбирает автор, секретов в репо нет | соблюдён (решение автора в 07-09 Task 1; секретов в README не найдено) |
| Не называть п. 4 закрытым без HTTPS + чек-листа | соблюдён по существу; см. пробел SC-6 по площадке |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | TBD/FIXME/XXX, `.skip/.only`, `waitForTimeout`, `eslint-disable`, `@ts-ignore`, CSS-локаторы в e2e | — | не найдено в файлах фазы |
| `.planning/phases/.../07-09-SUMMARY.md:58`, `docs/memory.md:14` | — | «Провайдер VPS автор не назвал», а README (da856a3) называет Play2Go | ℹ️ Info | устаревшая формулировка, проверяющий может заметить противоречие |
| `.planning/STATE.md` | — | «Plan: 10 of 10 / Ready to execute / Next: 07-09» | ℹ️ Info | позиция не обновлена после 07-09 |
| рабочее дерево | — | незакоммиченные правки 5 тестов hooks под Windows (`format-and-lint`, `pre-compact`, `protect-files`, `reviewer-readonly`, `session-start`) и `.planning/config.json` | ℹ️ Info | unit-прогон 605/606 включает эти правки; на чистом HEAD в Windows красных может быть больше (вне фазы, D-16) |
| `src/client-v2/styles.css` | 1 | Tailwind без `source(...)` сканирует весь репозиторий | ℹ️ Info | сборка из «грязного» дерева тянет лишние классы из `docs/` (в т. ч. `bg-[#fff]`, `outline-none`); прод собран из чистого дерева и их не содержит |
| `package.json` | — | `shadcn` (CLI) в `dependencies` | ℹ️ Info | ставится в образ `api` через `npm ci --omit=dev`; лишний вес, не ошибка |

### Human Verification Required

1. **Полный e2e** — в WSL без переменных прокси `npm run test:e2e` на HEAD. Ожидается 66 passed. Закрывает SC-3, SC-7 и прогон loans/smoke для SC-4.
2. **Docker локально** — уже подтверждено автором («docker ok», шаг 5 «5 passed»); вывод шагов 2, 3, 4, 6 не прислан, шаг 7 не упомянут. Для UAT достаточно повторного подтверждения или вывода `v2-main-flow` против `http://localhost:8080` и счёта книг до/после `docker compose restart`.
3. **VPS** — подтверждено автором («сайт развернут, все ок») и внешними проверками верификатора.
4. **Judgment-запреты** — подтвердить вердикты таблицы «Prohibitions».

### Gaps Summary

Единственный пробел — **площадка хостинга (SC-6, HW4-4)**. По сути пункт 4 выполнен: публичная HTTPS-ссылка, деплой совпадает с HEAD, чек-лист D-13 проходит (перепроверено), порты закрыты, seed загружен в том. По букве ROADMAP SC-6 и задания — нет: «Vercel или TimeWeb Cloud». Раскрытие в README хорошее (раздел «Принятый риск», провайдер Play2Go, стек, причина, «Vercel и TimeWeb Cloud: не использовались»), но неполное: причина «статический хостинг не подходит» объясняет отказ от Vercel и не объясняет отказ от TimeWeb Cloud, где можно поднять тот же Docker Compose. Ещё прототип (чистая статика) можно было выложить на Vercel (D-15).

Отклонение намеренное, его выбрал автор. Чтобы его принять, автор добавляет в frontmatter этого файла:

```yaml
overrides:
  - must_have: "Есть публичная ссылка на Vercel или TimeWeb Cloud, по ней проходит чек-лист перед показом"
    reason: "Собственный VPS (Play2Go) с Docker Compose и Caddy: MVP нужен постоянный диск (D-14); выбор площадки за автором (D-15); отклонение раскрыто в README «Принятый риск»"
    accepted_by: "<автор>"
    accepted_at: "<ISO timestamp>"
```

После override и повторной верификации статус станет `human_needed` (пункты 1–4 выше), а после полного e2e и подтверждения Docker — `passed`.

### Повторная проверка (2026-11-16, оркестратор)

- Override SC-6 принят автором (frontmatter `overrides`); в README «Принятый риск» добавлена причина для TimeWeb Cloud.
- `npm run test:e2e` на рабочей копии (HEAD da856a3 + правка README): **66 passed** (31.8 s) — SC-3, SC-4, SC-7 подтверждены.
- Docker локально и VPS — человеческие проверки, выполнены автором («docker ok», «сайт развернут, все ок»).
- Остаётся: автор подтверждает вердикт «соблюдён» по judgment-запретам (раздел «Prohibitions»).

---

_Verified: 2026-11-16T17:15:00Z_
_Verifier: Claude (gsd-verifier)_
