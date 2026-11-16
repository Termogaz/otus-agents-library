---
phase: 07-bystroe-prototipirovanie-i-sborka-mvp
plan: 08
subsystem: release-checklist-and-screenshots
tags: [playwright, release-checklist, screenshots, docker-check]
status: complete

requires:
  - phase: 07-bystroe-prototipirovanie-i-sborka-mvp
    provides: "07-03 (Docker-сборка), 07-07 (прототип /prototype/ и его снимки)"
provides:
  - "Чек-лист перед показом (D-13) для /, /v2/, /prototype/: заголовок, консоль, коды ответов от 400, ширина 375 px без горизонтальной прокрутки на /v2/ и /prototype/; запускается против любого адреса через E2E_BASE_URL"
  - "Основной сценарий /v2/ на настоящем сервере (D-11): книга, читатель, выдача, возврат, после каждого шага свой role=status"
  - "Пять снимков hw4-v2-{work,issued,refusal,narrow-375}.png и hw4-old-links.png; вместе с восемью hw4-prototype-*.png из 07-07 — 13 файлов hw4-*.png"
  - "Проверка Docker автором (D-14): ответ «docker ok»"
affects: [07-09]

actuals:
  tokens: 12000
  tasks: 3
  commits: 4

plan_head_before: 178ebe007b43985294303460b4fb6c6bee27de02
plan_head_after: 7499838ac5b1f99b5c6d50409f9c187655dd64d2
commits: 4

tech-stack:
  added: []
  patterns:
    - "Запросы к fonts.googleapis.com и fonts.gstatic.com прерываются; ошибки консоли и ответы с этих хостов не считаются; E2E_REAL_FONT=1 снимает фильтр"
    - "Фильтр ошибок консоли смотрит на message.location().url, а не на текст"
    - "Тесты основного сценария и снимков создают свои записи и фильтруют GET списков по id (route.fetch), не зависят от данных на сервере"

key-files:
  created:
    - tests/e2e/release-checklist.spec.ts
    - tests/e2e/v2-main-flow.spec.ts
    - tests/e2e/hw4-screenshots.spec.ts
    - docs/screenshots/hw4-v2-work.png
    - docs/screenshots/hw4-v2-issued.png
    - docs/screenshots/hw4-v2-refusal.png
    - docs/screenshots/hw4-v2-narrow-375.png
    - docs/screenshots/hw4-old-links.png
  modified:
    - docs/memory.md

key-decisions:
  - "Чек-лист D-13 запускается против любого E2E_BASE_URL (dev, Docker на 8080, публичная ссылка); пути относительные"
  - "Фильтр шрифтов: запросы к Google Fonts прерываются, E2E_REAL_FONT=1 включает настоящий шрифт"
  - "Тест снимков создаёт свои демо-записи через API и показывает только их: настоящие данные в кадр не попадают"
  - "Docker подтверждён автором ответом «docker ok»"

requirements-completed: [HW4-4, NFR-1]

duration: 3 tasks (Docker-проверка автора вне времени исполнителя)
completed: 2026-11-15
---

# Phase 7 Plan 08: чек-лист перед показом, основной сценарий /v2/, снимки, проверка Docker Summary

Чек-лист D-13 для трёх страниц, основной сценарий `/v2/` на настоящем сервере и пять снимков для README лежат в git и проходят на dev-сервере; автор подтвердил локальный запуск Docker ответом «docker ok».

## Выполнено

- **Task 1, 9f11d5e.** `tests/e2e/release-checklist.spec.ts`: пять тестов. Три на заголовок вкладки, ошибки консоли, `pageerror` и ответы от 400 для `/`, `/v2/`, `/prototype/`; два на ширину 375 px без горизонтальной прокрутки для `/v2/` и `/prototype/` (для `/` ширину не проверяем, D-04). Пути относительные, файл работает с `playwright.config.ts`, `playwright.docker.config.ts` и публичной ссылкой через `E2E_BASE_URL`.
- **Task 2, 6d015d4.** `tests/e2e/v2-main-flow.spec.ts` (книга, читатель, выдача, возврат, после каждого шага свой `role="status"`), `tests/e2e/hw4-screenshots.spec.ts`, пять PNG, запись в `docs/memory.md`.
- **Task 2 (исправление), b3b29e5.** Тест снимков переписан: не зависит от `data/seed.json` и настоящих данных; пять снимков сняты заново.
- **Task 3 (checkpoint:human-verify, blocking), 7499838.** Проверку Docker выполнил автор; результат записан в `docs/memory.md` (коммит 7499838, только этот файл).

## Проверка Docker автором (D-14)

Ответ автора: «docker ok». Автор работает в Windows PowerShell 5.1. Записано только то, что он сообщил:

- Команда шага 3 плана `curl -sI ...` в PowerShell упала с `Invoke-WebRequest : Не удается найти параметр, соответствующий имени параметра "sI"`: `curl` там псевдоним `Invoke-WebRequest`. Это ошибка синтаксиса команды, не сбой контейнера. Автору даны исправленные команды: `curl.exe -sI ...`, `curl.exe -s -o NUL -w "%{http_code}" ...`, а переменные окружения через `$env:E2E_BASE_URL = '...'; npx playwright ...` и `$env:E2E_REAL_FONT = '1'; npx playwright ...` вместо формы `ИМЯ=значение команда`.
- Сайт открывается в браузере и показывает все страницы: контейнеры собраны и запущены (значит, `npm ci` под linux-musl в образе не упал).
- Шаг 5 (`E2E_REAL_FONT=1`, `release-checklist` против `http://localhost:8080`): автор сообщил «5 passed».
- Шаги 2, 3, 4 и 6: подтверждены ответом «docker ok», вывод автор не прислал.
- Шаг 7 (необязательный, `docker compose down -v`, seed в пустой том): автор не сообщил, выполнялся ли он.

## Проверки

- Оркестратор: `npm run check` 605 из 606 (красный один, известный тест хука `format-and-lint`, D-16); FREEZE код 0; для `src/client/App.tsx` `6 0` (только добавленные строки); 13 файлов `hw4-*.png`; маркеров и атрибуции нет.
- Playwright 66 из 66 по отчёту предыдущего исполнителя (в этом запуске не перепроверялось).
- Docker: см. раздел выше.

## Deviations from Plan

**1. [Rule 3 - Blocking] Копия seed для прогона вне `test-results/`.**
- **Found during:** Task 2
- **Issue:** Playwright очищает `test-results/` в начале запуска вместе с положенной туда копией seed.
- **Fix:** копия лежит вне `test-results/`.
- **Commit:** 6d015d4

**2. [Rule 1 - Bug] `hw4-screenshots.spec.ts` не зависит от seed.**
- **Found during:** Task 2
- **Issue:** исходная версия опиралась на seed и падала в обычном `npm run test:e2e` на пустом файле данных.
- **Fix:** тест создаёт свои демо-записи через API и фильтрует GET списков по id; снимки сняты заново.
- **Files modified:** `tests/e2e/hw4-screenshots.spec.ts`, пять PNG, `docs/memory.md`
- **Commit:** b3b29e5

Других отклонений нет. Шаг 3 плана с `curl -sI` и форма `ИМЯ=значение команда` не подходят для PowerShell 5.1; это замечено автором, записано в ловушки `docs/memory.md`, сам план не менялся.

## Known Stubs

Нет.

## Threat Flags

Нет новой поверхности вне модели угроз плана.

## Self-Check: PASSED

- FOUND: tests/e2e/release-checklist.spec.ts, tests/e2e/v2-main-flow.spec.ts, tests/e2e/hw4-screenshots.spec.ts, пять docs/screenshots/hw4-v2-*.png и hw4-old-links.png, docs/memory.md
- FOUND commits: 9f11d5e, 6d015d4, b3b29e5, 7499838
