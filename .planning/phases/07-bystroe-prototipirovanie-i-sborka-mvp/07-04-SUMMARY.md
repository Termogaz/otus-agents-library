---
phase: 07-bystroe-prototipirovanie-i-sborka-mvp
plan: 04
subsystem: client-v2-core
tags: [react, outcome, status, busy-lock, playwright, tdd]
status: complete

requires:
  - phase: 07-bystroe-prototipirovanie-i-sborka-mvp
    provides: "07-01 (Tailwind, три страницы Vite), 07-02 (App({ api, mode }) без бизнес-правил, правила слоёв), 07-03 (сборка и семя), 07-10 (компоненты shadcn)"
provides:
  - "src/client-v2/App.tsx: App({ api, mode }) с загрузкой списков, единым итогом и run() с раздельными действием и обновлением"
  - "components/StatusMessage.tsx: итог error (role=alert), success и saved (role=status), перевод фокуса и прокрутка к итогу"
  - "features/{Loans,Books,Readers}Section.tsx: формы с итогом под кнопкой, итог возврата над таблицей, ReturnButton с собственной блокировкой"
  - "loan-view.ts: formatDate (ДД.ММ.ГГГГ), readDueAt (срок из ответа выдачи типа unknown)"
  - "use-busy.ts: хук блокировки действия на время запроса и обновления списков"
  - "tests/e2e/fake-api.ts: createGate() для удержания ответов сервера без пауз по времени"
affects: [07-05, 07-06, 07-07]

actuals:
  tokens: 10700
  tasks: 3
  commits: 3

plan_head_before: c6e17ecb25f02fca3785425b536bafb7df334f63
plan_head_after: cd6003b82f8c35b53eef68f51167b62b18c310f5
commits: 3

tech-stack:
  added: []
  patterns:
    - "Один итог на страницу: Outcome { kind, place, text }, роль alert только у error"
    - "run(): действие и обновление списков в разных try; сбой чтения после записи даёт kind saved"
    - "useBusy: флаг в ref отбрасывает второй клик, flushSync(setBusy(false)) до возврата фокуса"
    - "Двойной клик в e2e: dblclick() плюс ворота createGate(), счётчик POST в page.route"

key-files:
  created:
    - src/client-v2/components/StatusMessage.tsx
    - src/client-v2/features/LoansSection.tsx
    - src/client-v2/features/BooksSection.tsx
    - src/client-v2/features/ReadersSection.tsx
    - src/client-v2/loan-view.ts
    - src/client-v2/use-busy.ts
    - tests/unit/loan-view.test.ts
    - tests/e2e/fake-api.ts
    - tests/e2e/v2-outcome.spec.ts
    - tests/e2e/v2-lock.spec.ts
  modified:
    - src/client-v2/App.tsx
    - src/client-v2/v2/main.tsx
    - docs/memory.md

key-decisions:
  - "Срок выдачи читает readDueAt: старый api.ts заморожен, checkout и returnLoan возвращают unknown"
  - "Блокировка через ref и flushSync: второй клик в тот же момент отбрасывается, кнопка доступна до возврата фокуса"
  - "У каждой строки «Вернуть» свой busy: соседняя кнопка не блокируется"
  - "Кнопка «Выдать» не зависит от числа свободных экземпляров: отказ приходит с сервера"

requirements-completed: [HW4-3, FR-2, FR-3, FR-5]

coverage:
  - id: D1
    description: "Отказ «Выдать» на настоящем сервере виден под кнопкой без прокрутки при 1280x800, ровно один role=alert"
    requirement: FR-2
    verification:
      - kind: e2e
        ref: "tests/e2e/v2-outcome.spec.ts: shows checkout refusal under the button without scrolling at 1280x800; replaces the refusal with the next success so no alert stays"
        status: pass
    human_judgment: false
  - id: D2
    description: "Успех книги, читателя, выдачи (название, имя, срок) и возврата; формы очищаются, выбор выдачи сохраняется; фокус по правилам ux-patterns"
    requirement: FR-5
    verification:
      - kind: e2e
        ref: "tests/e2e/v2-outcome.spec.ts: book added, reader added, checkout status, return status"
        status: pass
      - kind: unit
        ref: "tests/unit/loan-view.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Сбой перечитывания списка после удачной записи показан как «Сохранено, но список не обновился», не как отказ; итог не исчезает по таймеру"
    requirement: FR-5
    verification:
      - kind: e2e
        ref: "tests/e2e/v2-outcome.spec.ts: shows saved status instead of a refusal when the list refresh fails; keeps the status on the page without a timer; shows return refusal above the table"
        status: pass
    human_judgment: false
  - id: D4
    description: "Двойной клик «Добавить», «Выдать», «Вернуть» даёт один POST; кнопка заблокирована до конца перечитывания; текст не меняется; соседнее «Вернуть» доступно; после итога повторная выдача уходит на сервер"
    requirement: FR-3
    verification:
      - kind: e2e
        ref: "tests/e2e/v2-lock.spec.ts (5 сценариев)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Заморозка корня: src/client, index.html, loans.spec.ts, smoke.spec.ts не изменены"
    requirement: HW4-3
    verification:
      - kind: command
        ref: "git diff --exit-code main -- src/client ':(exclude)src/client/App.tsx' index.html tests/e2e/loans.spec.ts tests/e2e/smoke.spec.ts: код 0"
        status: pass
    human_judgment: false
---

# Phase 7 Plan 04: ядро /v2/ на настоящем API Summary

Страница `/v2/` работает на настоящем API: формы книг, читателей и выдачи, возврат, итог каждого действия рядом с кнопкой (ошибка с `role="alert"`, успех и «сохранено» с `role="status"`), блокировка кнопки на время запроса и перечитывания списков.

## Выполнено

- **Task 1 (tracer), 65a3181.** Каркас `App`, `StatusMessage`, `LoansSection`, `loan-view.ts` (+ тест) и e2e: отказ «Выдать» под кнопкой виден без прокрутки при 1280x800 на настоящем сервере. Сквозная проверка трассера прошла (Playwright 5/5), расширение продолжено.
- **Task 2 (tdd), 27fbbda.** Формы книг и читателей, итоги успеха, возврат с итогом над таблицей, раздельные `try` в `run()` («Сохранено, но список не обновился. Обновите страницу»), правила фокуса, 8 новых e2e-сценариев.
- **Task 3 (tdd), cd6003b.** `createGate()`, `v2-lock.spec.ts` (5 сценариев), хук `useBusy`, `disabled={busy}` на кнопках «Добавить», «Выдать», `ReturnButton` с собственной блокировкой, запись в `docs/memory.md`.

## Evidence: RED до правки кода

**Unit `loan-view` (до реализации):** модуль `src/client-v2/loan-view.ts` не существовал, vitest: `Test Files 1 failed (1)`, тестов нет (ошибка импорта).

**e2e `v2-outcome` (до реализации Task 2):** 8 из 8 новых сценариев красные (нет форм книг и читателей, нет колонки «Вернуть»).

**e2e `v2-lock` (до `useBusy`):** `npx playwright test tests/e2e/v2-lock.spec.ts`, итог `4 failed, 1 passed`. Риск двойного POST воспроизведён:

```text
1) v2-lock.spec.ts:41 › sends one request when the add book button is double clicked
    Error: expect(received).toBe(expected) // Object.is equality
    Expected: 1
    Received: 2
    > 63 |   expect(posts).toBe(1);

2) v2-lock.spec.ts:69 › sends one request when the checkout button is double clicked
    Error: expect(received).toBe(expected) // Object.is equality
    Expected: 1
    Received: 2
    > 93 |   expect(posts).toBe(1);

3) v2-lock.spec.ts:97 › sends one request when the return button is double clicked and keeps the neighbour enabled
    Error: expect(locator).toBeDisabled() failed
    Expected: disabled
    Received: enabled

4) v2-lock.spec.ts:138 › keeps the button blocked until the list refresh finishes and then returns focus
    Error: expect(locator).toBeDisabled() failed
    Expected: disabled
    Received: enabled
```

Пятый сценарий (повторная выдача после итога) зелёный до правки и остаётся таким: кнопка не блокируется по числу экземпляров.

## Проверки (после Task 3)

- `npm run typecheck`, `npm run lint`, `npm run format:check`: чисто.
- Vitest: 597 тестов, один красный, известный `format-and-lint hook script formats edited file in place with exit code 0` (базовые 593 плюс 4 теста `loan-view`).
- Playwright, весь набор: 18 из 18 (`loans`, `smoke`, `v2-shell`, `v2-outcome`, `v2-lock`), с `LIBRARY_DATA_FILE` во временном каталоге, порты 3000 и 5173 перед запуском свободны.
- В `App.tsx`, `features/*`, `StatusMessage.tsx`, `use-busy.ts` нет `setTimeout` и `setInterval`; в e2e нет `waitForTimeout`.
- FREEZE: код 0.

## Deviations from Plan

**1. [Rule 3 - Blocking] `loan-view.ts` и его тест созданы в коммите Task 1, не Task 2.**
- **Found during:** Task 1
- **Issue:** таблица выдач в Task 1 показывает срок, для этого нужен `formatDate`.
- **Fix:** тест и модуль добавлены в 65a3181; RED снят до реализации (модуль не существовал).
- **Commit:** 65a3181

**2. [Rule 2 - Missing critical] Добавлен файл `src/client-v2/use-busy.ts`, которого нет в `files_modified`.**
- **Found during:** Task 3
- **Issue:** одна и та же блокировка нужна трём формам и строкам возврата; без общего хука она повторялась бы четырежды.
- **Fix:** общий хук с флагом в ref (отбрасывает второй клик в тот же момент) и `flushSync` перед возвратом фокуса.
- **Commit:** cd6003b

**3. [Rule 1 - Environment] Хук `format-and-lint` отвечает `spawnSync ... ENOENT` после каждой правки.** Prettier запускался вручную (`npx prettier --write`), typecheck и lint чистые. Не дефект кода плана.

**4. Первый запуск e2e в Task 1 дал 3 красных из 5.** Причина: мой же отладочный `npx vite` на порту 5173, Playwright переиспользовал его без API. Отладочный процесс и временный spec удалены, порты проверены, повтор 5 из 5.

## Known Stubs

Таблица читателей, тексты пустого списка и загрузки, колонка статуса выдач намеренно отсутствуют в `ReadersSection` и таблице выдач: их добавляет план 07-05 (комментарий в `ReadersSection.tsx`). Форма читателя и итоги работают полностью.

## Threat Flags

None. Новых сетевых точек и путей доступа к файлам нет, `src/server/**` и `src/domain/**` не менялись.

## Self-Check: PASSED

- FOUND: src/client-v2/App.tsx, components/StatusMessage.tsx, features/LoansSection.tsx, features/BooksSection.tsx, features/ReadersSection.tsx, loan-view.ts, use-busy.ts, tests/unit/loan-view.test.ts, tests/e2e/fake-api.ts, tests/e2e/v2-outcome.spec.ts, tests/e2e/v2-lock.spec.ts
- FOUND commits: 65a3181, 27fbbda, cd6003b
