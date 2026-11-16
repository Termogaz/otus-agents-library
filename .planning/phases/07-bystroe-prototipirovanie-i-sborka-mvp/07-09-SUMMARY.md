---
phase: 07-bystroe-prototipirovanie-i-sborka-mvp
plan: 09
subsystem: hosting-and-readme
tags: [hosting, vps, caddy, docker, release-checklist, readme]
status: complete

requires:
  - phase: 07-bystroe-prototipirovanie-i-sborka-mvp
    provides: "07-03 (Docker-сборка), 07-07 (прототип и снимки), 07-08 (чек-лист D-13, снимки MVP, проверка Docker автором)"
provides:
  - "Публичный адрес https://otus-ai.silentharbor.ru/ : / (прежний интерфейс), /v2/ (MVP), /prototype/ (прототип), один домен"
  - "Чек-лист D-13 на публичном адресе с E2E_REAL_FONT=1: 5 passed; --grep /prototype/: 2 passed"
  - "Снимки hw4-public-v2-375.png и hw4-public-prototype.png (только чтение, записей на сервере нет)"
  - "README «Модуль 4»: три варианта, публичные ссылки, таблица пунктов ДЗ, библиотеки с урока, принятый риск, что не подтверждено; строки в «Структура»"
affects: [phase-07-verification]

actuals:
  tokens: 4100
  tasks: 3
  commits: 1

plan_head_before: 058d8439d9c382edc71d4776fa5c5f52ca90fa45
plan_head_after: 30b1d1be00e7e939244a1554571628253ce890e6
commits: 1

tech-stack:
  added: []
  patterns:
    - "Публичная проверка тем же release-checklist.spec.ts через playwright.docker.config.ts и E2E_BASE_URL"
    - "Разовый скрипт снимков считает запросы не GET/HEAD и завершается с кодом 1, если они были"

key-files:
  created:
    - docs/screenshots/hw4-public-v2-375.png
    - docs/screenshots/hw4-public-prototype.png
  modified:
    - README.md
    - docs/memory.md

key-decisions:
  - "Хостинг (Task 1, автор): собственный VPS (1 vCPU, 2 ГБ, Ubuntu) с Docker Compose и Caddy (HTTPS, reverse_proxy на 127.0.0.1:8080), а не Vercel или TimeWeb Cloud; в README — принятый риск с причиной (MVP пишет в файл на томе, D-14)"
  - "Один домен для трёх страниц: VITE_APP_ORIGIN не задаётся, ссылки между вариантами относительные"
  - "21st.dev в README — только просмотренные образцы (как в DESIGN.md «Откуда взято»), код оттуда не брался"

requirements-completed: [HW4-1, HW4-2, HW4-3, HW4-4]

duration: 3 tasks (публикация автором вне времени исполнителя; Task 3 около 15 мин)
completed: 2026-11-16
---

# Phase 7 Plan 09: публикация на VPS, чек-лист на публичном адресе и README «Модуль 4» Summary

MVP, прототип и прежний интерфейс опубликованы автором на собственном VPS за Caddy по адресу https://otus-ai.silentharbor.ru/; чек-лист D-13 с настоящими шрифтами проходит на публичном адресе (5 passed), README «Модуль 4» связывает четыре пункта ДЗ-4 с артефактами, командами, 17 ссылками на снимки и публичными ссылками.

## Выполнено

- **Task 1 (checkpoint:decision), решение автора.** Собственный VPS (1 vCPU, 2 ГБ, Ubuntu, Финляндия) с Docker Compose и Caddy: HTTPS, `reverse_proxy` на `127.0.0.1:8080`. Ни один из вариантов A–D плана буквально (ближе всего B, но не TimeWeb). Провайдер VPS автор не назвал. До публикации порт `web` в compose привязан к localhost хоста — коммит `6ff3320` (`fix(07-09)`, сделан до этого исполнителя, вне счётчика коммитов плана).
- **Task 2 (checkpoint:human-action), результат автора.** «сайт развернут, все ок», адрес https://otus-ai.silentharbor.ru/ . Оркестратор проверил `curl`: `/`, `/v2/`, `/prototype/`, `/api/health`, `/api/books` — 200; порт 8080 снаружи не отвечает.
- **Task 3 (auto), 30b1d1b.** Чек-лист на публичном адресе, снимки, раздел README, запись в `docs/memory.md` (журнал идёт в docs-коммит вместе с этим SUMMARY).

## Проверка публичного адреса (D-13)

- `E2E_BASE_URL=https://otus-ai.silentharbor.ru E2E_REAL_FONT=1 npx playwright test -c playwright.docker.config.ts tests/e2e/release-checklist.spec.ts`: **5 passed** (заголовок, консоль, ответы от 400 для `/`, `/v2/`, `/prototype/`; 375 px без горизонтальной прокрутки для `/v2/` и `/prototype/`).
- То же с `--grep "/prototype/"` (как в плане): **2 passed**. В Git Bash нужен `MSYS_NO_PATHCONV=1`, иначе аргумент превращается в путь Windows и Playwright отвечает «No tests found».
- `curl -sI`: `/v2` и `/prototype` без косой черты — `301` с `Location: /v2/` и `/prototype/`; `/v2/`, `/prototype/` — `200`; `X-Content-Type-Options: nosniff` во всех ответах; `http://…/v2/` — `308` на `https://…/v2/`.
- Снимки: `/v2/` 375×812 во всю страницу, `/prototype/` 1280×800 во всю страницу, новые контексты Chromium. Ссылка «MVP» в подвале прототипа — `https://otus-ai.silentharbor.ru/v2/`. Запросов не GET/HEAD: 0. На снимках только «Демо-…» и `@example.test` (данные seed).

## Проверки

- `npm run typecheck`, `npm run lint`, `npm run format:check` — зелёные.
- Vitest: 606 тестов, красный один — известный `format-and-lint hook script formats edited file in place with exit code 0` (D-16).
- Проверка README из `<verify>` плана: раздел «Модуль 4» один и стоит перед «Что не воспроизводится из git», слова TailArk, GSAP, Design OS, UI/UX Pro Max, 21st.dev, «Принятый риск» на месте, HTTPS-ссылка на `/v2/` есть, 17 ссылок на снимки `hw4-*`, все файлы существуют.
- FREEZE: код 0; `src/client/App.tsx` — `6 0` (только добавленные строки).
- UI-код не менялся, `npm run test:e2e` не запускался.

## Deviations from Plan

**1. [Решение автора] Площадка — собственный VPS, а не Vercel / TimeWeb Cloud.** Отклонение от буквы пункта 4 задания и от вариантов Task 1. В README «Принятый риск»: MVP пишет данные в файл на томе (D-14), статический хостинг для `/v2/` не подходит, выбор площадки за автором (D-15).

**2. [Точность] 21st.dev не «взят».** План перечислял «образцы 21st.dev» среди взятых. По `DESIGN.md` («Откуда взято») каталог только просмотрен, код не брался; README пишет именно так, в списке «Взяты» с оговоркой.

**3. [Точность] «Spline» в строке отказа не упомянут.** В задании оркестратора было «Spline/Design OS», в D-06 и плане — только Design OS; причина отказа из CONTEXT относится к Design OS, поэтому в README строка «Design OS».

**4. [Rule 3 - Blocking] `MSYS_NO_PATHCONV=1` для `--grep "/prototype/"`.** Без него Git Bash переписывает аргумент; тесты не менялись.

## Known Stubs

Нет.

## Threat Flags

Нет новой поверхности вне модели угроз плана. T-07-24 закрыт так: HTTPS через Caddy, `http://` перенаправляется на `https://`, порт 8080 опубликован только на `127.0.0.1` (облачный фаервол не нужен для 8080; какие ещё порты открыты на VPS, не проверялось). T-07-23 (запись без входа) принят и записан в README.

## Что не подтверждено

- Вывод `docker compose ps` на VPS и настройки Caddy — известны только со слов автора.
- Сброс тома на VPS (`docker compose down -v`) не проверялся.
- Настоящие телефоны и браузеры, кроме Chromium.

## Self-Check: PASSED

- FOUND: README.md (раздел «Модуль 4»), docs/screenshots/hw4-public-v2-375.png, docs/screenshots/hw4-public-prototype.png, docs/memory.md (верхняя запись 07-09)
- FOUND commit: 30b1d1b
