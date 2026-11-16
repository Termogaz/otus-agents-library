---
phase: 07-bystroe-prototipirovanie-i-sborka-mvp
plan: 02
subsystem: client-v2-demo
tags: [demo-adapter, typescript, vitest, layers]
status: complete

requires:
  - phase: 07-bystroe-prototipirovanie-i-sborka-mvp
    provides: "07-01 (Vite, Tailwind, страницы /v2/ и /prototype/), 07-10 (компоненты shadcn)"
provides:
  - "createDemoApi(options): адаптер API в памяти браузера формы typeof api, без сети"
  - "createDemoData(now): вымышленные книги, читатели и выдачи с датами от now"
  - "tests/unit/client-v2-layers.test.ts: правило слоёв для src/client-v2"
affects: [07-03, 07-04, 07-05, 07-06]

actuals:
  tokens: 6700
  tasks: 3
  commits: 3

plan_head_before: dc89e844a4fb1a4d43488c8c5175caa40c9accc0
plan_head_after: cbc4c36c7bf43e871e46c43b9b1af4c932ba3877
commits: 3

tech-stack:
  added: []
  patterns:
    - "Адаптер API с той же формой, что клиент: состояние в замыкании экземпляра, часы и генератор id снаружи"
    - "Тест слоёв сканирует каталог при каждом запуске, поэтому файлы следующих планов проверяются автоматически"

key-files:
  created:
    - src/client-v2/demo/demo-data.ts
    - src/client-v2/demo/demo-api.ts
    - tests/unit/demo-api.test.ts
    - tests/unit/client-v2-layers.test.ts
  modified: []

key-decisions:
  - "Q1 (автор): «A: функции домена». Адаптер вызывает checkoutBook, returnBook, availableCopies, isOverdue; импорт src/domain разрешён только из src/client-v2/demo/ и закреплён тестом слоёв"
  - "holdActions возвращает обещание, которое не разрешается; тест ждёт маркер после очереди микрозадач, иначе уже отклонённое обещание могло бы выиграть гонку"

requirements-completed: [HW4-2]

coverage:
  - id: D1
    description: "Адаптер createDemoApi повторяет форму api, работает без сети, отказы идут ApiError с кодами сервера"
    requirement: HW4-2
    verification:
      - kind: unit
        ref: "tests/unit/demo-api.test.ts"
        status: pass
  - id: D2
    description: "Правило слоёв src/client-v2: из старого клиента только api.ts, без server и Node, домен только из demo/"
    requirement: HW4-2
    verification:
      - kind: unit
        ref: "tests/unit/client-v2-layers.test.ts"
        status: pass
---

# Phase 7 Plan 02: Адаптер демо-данных Summary

Адаптер `createDemoApi` в памяти браузера с формой `typeof api`: списки и действия работают на чистых функциях `src/domain`, отказы приходят `ApiError` с теми же кодами, что на сервере; правило слоёв закреплено тестом.

## Выполнено

- **Task 1 (tracer), 746b52c.** `createDemoData(now)`: 6 книг, 4 читателя, 6 выдач с датами от `now` (просроченная, «На руках», возвращённая, книга без свободных экземпляров, читатель на лимите); `createDemoApi` со списками, сценариями `empty` и `failLists`.
- **Task 2 (checkpoint:decision).** Ответ автора на Q1, дословно: «A: функции домена».
- **Task 3 (TDD), 305ef37 (RED) и cbc4c36 (GREEN).** Действия `checkout`, `returnLoan`, `addBook`, `addReader`, опции `newId`, `failListsAfterAction`, `holdActions`; тест слоёв.

## Решение автора Q1

«A: функции домена». Адаптер прототипа импортирует `checkoutBook`, `returnBook`, `availableCopies`, `isOverdue` из `src/domain/index`. Исключение из правила «client → HTTP → server → domain» ограничено каталогом `src/client-v2/demo/`; тест `imports domain only from the demo adapter` падает на импорте домена вне `demo/` и на отсутствии импорта в `demo-api.ts` (правила не копируются). `AGENTS.md` и `src/domain/**` не менялись.

## TDD: красная фаза (до реализации)

Запуск `npx vitest run tests/unit/demo-api.test.ts tests/unit/client-v2-layers.test.ts` перед правкой `demo-api.ts`: 11 красных из 22.

```text
× imports domain only from the demo adapter              AssertionError: expected false to be true
× issues a free book and returns the saved loan          Error: INTERNAL_ERROR
× rejects checkout of a book without free copies ...     expected 'INTERNAL_ERROR' to be 'NO_FREE_COPIES'
× rejects checkout for a reader at the limit ...         expected 'INTERNAL_ERROR' to be 'LOAN_LIMIT_REACHED'
× returns a loan once and rejects the second return ...  Error: INTERNAL_ERROR
× rejects unknown book, reader and loan ids ...          expected 'INTERNAL_ERROR' to be 'BOOK_NOT_FOUND'
× adds a book and a reader with generated ids            Error: INTERNAL_ERROR
× rejects invalid book and reader fields ...             expected 'INTERNAL_ERROR' to be 'VALIDATION_ERROR'
× fails list calls after a successful action ...         promise rejected "Error: INTERNAL_ERROR"
× keeps the action pending in the waiting scenario       expected 'settled' to be Symbol(pending)
× keeps state per instance                               Error: INTERNAL_ERROR
Tests  11 failed | 11 passed (22)
```

После реализации: 22 из 22 зелёные.

## Проверки

- `npm run typecheck`, `npm run lint`, `npm run format:check`: чисто.
- Полный Vitest: 589 тестов, один красный, известный `format-and-lint hook script formats edited file in place with exit code 0` (D-16).
- `git diff --exit-code main -- src/domain src/server`: пусто. FREEZE: код 0.
- Ручная проверка теста слоёв: временный файл `src/client-v2/lib/probe.ts` с импортами `../../client/App` и `../../domain/index` уронил `imports from the old client only api.ts` и `imports domain only from the demo adapter` (2 красных из 4); файл удалён, тесты снова 4 из 4, правка не коммитилась.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Слабый тест состояния «Ожидание»**
- **Found during:** Task 3 (RED)
- **Issue:** маркер `Promise.resolve(pending)` из плана выигрывает гонку у любого обещания, в том числе у уже отклонённого, поэтому тест прошёл бы на заглушке.
- **Fix:** маркер срабатывает через `setTimeout(0)`, после очереди микрозадач; тест красный на заглушке и зелёный на реализации.
- **Files modified:** tests/unit/demo-api.test.ts
- **Commit:** 305ef37

**2. Тест слоёв: сверх плана добавлены `scans the source files of client-v2` и проверка, что `demo-api.ts` импортирует домен** (иначе тест слоёв мог пройти вхолостую на пустом списке файлов).

REFACTOR-коммит не понадобился: после GREEN чистить было нечего.

## Known Stubs

None.

## Threat Flags

None. T-07-03 (демо-данные «Демо-…», `@example.test`) закрыт тестом `contains no real names or contacts`; T-07-04 (слои) закрыт `client-v2-layers.test.ts` и пустым diff `src/domain`.

## Self-Check: PASSED

- FOUND: src/client-v2/demo/demo-data.ts, src/client-v2/demo/demo-api.ts, tests/unit/demo-api.test.ts, tests/unit/client-v2-layers.test.ts
- FOUND commits: 746b52c, 305ef37, cbc4c36
