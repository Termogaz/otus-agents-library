---
phase: 07-bystroe-prototipirovanie-i-sborka-mvp
plan: 07
subsystem: prototype-demo-states
tags: [react, vite-mpa, demo-data, hash-scenarios, playwright]
status: complete

requires:
  - phase: 07-bystroe-prototipirovanie-i-sborka-mvp
    provides: "07-02 (createDemoApi), 07-05 (списки, подсказки), 07-06 (App с проп variant, VariantFooter, Motion)"
provides:
  - "Страница /prototype/ на демо-данных адаптера в памяти браузера: ни одного запроса к /api (D-10)"
  - "Восемь состояний макета по хешу #work, #first, #failed, #waiting, #saved, #issued, #refusal, #returned без роутера (D-02)"
  - "Панель «Состояния прототипа» (PrototypeBar): восемь ссылок, aria-current у текущей, подсказка без живой роли"
  - "Восемь снимков docs/screenshots/hw4-prototype-*.png только на демо-данных"
affects: [07-08, 07-09]

actuals:
  tokens: 14000
  tasks: 3
  commits: 4

plan_head_before: 8353ffd2aef65aae19899c50179672910d6ddfac
plan_head_after: 178ebe007b43985294303460b4fb6c6bee27de02
commits: 4

tech-stack:
  added: []
  patterns:
    - "Хеш адреса как внешнее состояние: useSyncExternalStore по hashchange; имя сценария ищется только в фиксированном списке SCENARIOS, неизвестное даёт work (T-07-20)"
    - "Новый createDemoApi на сценарий (useMemo), now фиксируется в момент открытия; App перемонтируется по key имени сценария"
    - "Три состояния видны сразу, пять получаются одним кликом: прототип ничего не подставляет без действия"
    - "Снимки пишутся тестом в test-results/hw4/ с проверкой «Демо-» в каждой строке таблиц и копируются в docs/screenshots"

key-files:
  created:
    - src/client-v2/prototype/scenarios.ts
    - src/client-v2/prototype/PrototypeBar.tsx
    - tests/unit/prototype-scenarios.test.ts
    - tests/e2e/prototype.spec.ts
    - docs/screenshots/hw4-prototype-work.png
    - docs/screenshots/hw4-prototype-first.png
    - docs/screenshots/hw4-prototype-failed.png
    - docs/screenshots/hw4-prototype-waiting.png
    - docs/screenshots/hw4-prototype-saved.png
    - docs/screenshots/hw4-prototype-issued.png
    - docs/screenshots/hw4-prototype-refusal.png
    - docs/screenshots/hw4-prototype-returned.png
  modified:
    - src/client-v2/prototype/main.tsx
    - docs/memory.md

key-decisions:
  - "Подсказка панели — обычный текст без role=alert: единственный alert страницы остаётся у приложения (D-12)"
  - "Пять состояний (ожидание, сохранено без списка, выдано, отказ, возвращено) получаются одним кликом, три (работа, первый запуск, сбой) видны сразу"
  - "Подсказки не цитируют тексты интерфейса дословно, иначе getByText ловит два элемента (strict mode)"

requirements-completed: [HW4-2]

coverage:
  - id: D1
    description: "/prototype/ открывается и работает без сервера: ни одного запроса к /api, данные только демо"
    requirement: HW4-2
    verification:
      - kind: e2e
        ref: "tests/e2e/prototype.spec.ts: opens prototype without any API request; в каждом тесте состояния apiRequests() равен 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Выбор состояния по хешу: известные имена дают опции адаптера, пустой и неизвестный хеш дают work, восемь подписей на русском"
    requirement: HW4-2
    verification:
      - kind: unit
        ref: "tests/unit/prototype-scenarios.test.ts (3 теста)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Восемь состояний макета: работа, первый запуск, сбой с одним alert, ожидание с заблокированной кнопкой, сохранено без списка, выдано, отказ, возвращено"
    requirement: HW4-2
    verification:
      - kind: e2e
        ref: "tests/e2e/prototype.spec.ts: по одному тесту на состояние (8)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Переключение состояния ссылками панели без перезагрузки страницы, aria-current у текущей ссылки"
    requirement: HW4-2
    verification:
      - kind: e2e
        ref: "tests/e2e/prototype.spec.ts: switches state through the panel links without a page reload"
        status: pass
    human_judgment: false
  - id: D5
    description: "Основной сценарий прокликивается: добавить книгу, добавить читателя, выдать, вернуть"
    requirement: HW4-2
    verification:
      - kind: e2e
        ref: "tests/e2e/prototype.spec.ts: completes main scenario on demo data"
        status: pass
    human_judgment: false
  - id: D6
    description: "Восемь снимков docs/screenshots/hw4-prototype-*.png сделаны на демо-данных: перед снимком каждая строка таблиц содержит «Демо-»"
    requirement: HW4-2
    verification:
      - kind: e2e
        ref: "tests/e2e/prototype.spec.ts: saves screenshots of eight states; node-проверка: ровно 8 непустых файлов"
        status: pass
      - kind: manual
        ref: "все восемь снимков просмотрены перед коммитом, видны только «Демо-…» и @example.test"
        status: pass
    human_judgment: false
  - id: D7
    description: "Заморозка корня и слоёв: src/client (кроме добавленных строк App.tsx), index.html, loans.spec.ts, smoke.spec.ts, src/domain, src/server не изменены"
    requirement: HW4-2
    verification:
      - kind: command
        ref: "FREEZE из плана: код 0"
        status: pass
    human_judgment: false

duration: 25 min
completed: 2026-11-15
---

# Phase 7 Plan 07: прототип /prototype/ на демо-данных Summary

Страница `/prototype/` рендерит тот же `App`, что `/v2/`, на адаптере демо-данных в памяти браузера без единого запроса к `/api`, а восемь состояний макета выбираются хешем адреса и ссылками панели «Состояния прототипа».

## Выполнено

- **RED, d76f51d.** `tests/unit/prototype-scenarios.test.ts` (3 теста) написан до кода и упал с `Cannot find module '../../src/client-v2/prototype/scenarios.js'`.
- **Task 1 (tracer, TDD), 3b8b783.** `scenarios.ts` (`SCENARIOS`, `scenarioOptions` с поиском только в фиксированном списке), `main.tsx` с подпиской на `hashchange`, новым `createDemoApi` на сценарий и `App` с `key` по имени сценария; первые тесты `prototype.spec.ts` (открытие без `/api`, работа, первый запуск).
- **Task 2, d1d4631.** `PrototypeBar.tsx`: строка «Прототип на демо-данных», `nav` «Состояния прототипа» с восемью ссылками и `aria-current`, подсказка текущего состояния обычным текстом; тесты состояний сбоя, ожидания, сохранения без списка, выдачи, отказа, возврата и переключения без перезагрузки.
- **Task 3, 178ebe0.** Основной сценарий «добавить книгу и читателя, выдать, вернуть»; тест снимков восьми состояний (перед каждым снимком сообщения полностью проявлены, каждая строка таблиц содержит «Демо-»); восемь PNG в `docs/screenshots/hw4-prototype-*.png`; запись в `docs/memory.md`.

## Проверки

- `npm run typecheck`, `npm run lint`, `npm run format:check`: чисто.
- Vitest: 606 тестов, один красный, известный `format-and-lint hook script formats edited file in place with exit code 0` (D-16).
- Playwright: 59 из 59 (47 прежних и 12 новых в `prototype.spec.ts`), отдельный `LIBRARY_DATA_FILE`.
- Снимки: ровно восемь непустых `hw4-prototype-*.png`, просмотрены глазами до коммита.
- FREEZE: код 0.
- В e2e нет `waitForTimeout`, CSS- и XPath-селекторов; временных спек в `tests/` нет.

## Deviations from Plan

**1. [Rule 1 - Bug] Подсказка сценария `failed` переформулирована.**
- **Found during:** Task 2
- **Issue:** первая редакция подсказки цитировала «Данные не загружены» дословно; тест `getByText('Данные не загружены')` нашёл бы два элемента (strict mode).
- **Fix:** подсказка описывает состояние своими словами («вместо таблиц короткий текст без таблицы»).
- **Files modified:** `src/client-v2/prototype/scenarios.ts`
- **Commit:** d1d4631

Других отклонений нет: план выполнен как написан.

## Known Stubs

Нет. Демо-данные в прототипе намеренные (D-10), не заглушки.

## Threat Flags

Нет новой поверхности вне модели угроз плана: хеш разбирается только поиском в фиксированном списке и нигде не выводится (T-07-20), запросов к `/api` из прототипа нет (T-07-19).

## Self-Check: PASSED

- FOUND: src/client-v2/prototype/scenarios.ts, src/client-v2/prototype/PrototypeBar.tsx, tests/unit/prototype-scenarios.test.ts, tests/e2e/prototype.spec.ts, восемь docs/screenshots/hw4-prototype-*.png
- FOUND commits: d76f51d, 3b8b783, d1d4631, 178ebe0
