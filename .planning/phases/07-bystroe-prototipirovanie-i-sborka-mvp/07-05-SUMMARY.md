---
phase: 07-bystroe-prototipirovanie-i-sborka-mvp
plan: 05
subsystem: client-v2-lists
tags: [react, shadcn-table, load-states, hints, playwright, tdd]
status: complete

requires:
  - phase: 07-bystroe-prototipirovanie-i-sborka-mvp
    provides: "07-04 (ядро /v2/: итоги, блокировка, loan-view.ts, createGate), 07-10 (Table с containerLabel и TableCaption, NativeSelect, Label)"
provides:
  - "loan-view.ts: orderLoans, activeLoanCount, loanStatus (только показ, просрочка из поля overdue)"
  - "App.tsx: состояние load ('loading', 'ready', 'failed') и проп load у трёх разделов"
  - "components/ListState.tsx: замена таблицы текстом «Загрузка…», «Данные не загружены» или текстом пустого списка"
  - "ReadersSection: таблица читателей; LoansSection: колонка «Статус», подсказки FR-6"
  - "tests/e2e/fake-api.ts: stubLists(page, { books, readers, loans })"
affects: [07-06, 07-07, 07-08]

actuals:
  tokens: 8500
  tasks: 3
  commits: 3

plan_head_before: cd6003b82f8c35b53eef68f51167b62b18c310f5
plan_head_after: 186c5347819bb32dde6450706f6a0afc1a6e0e5e
commits: 3

tech-stack:
  added: []
  patterns:
    - "Имя таблицы из TableCaption, имя контейнера прокрутки через containerLabel; в e2e таблица ищется по подписи, контейнер как region"
    - "ListState: одна точка выбора между текстом состояния и таблицей"
    - "stubLists: подмена GET списков через page.route и route.fulfill, остальные методы через route.fallback()"
    - "Строки тела таблицы в e2e: getByRole('rowgroup').nth(1).getByRole('row')"

key-files:
  created:
    - src/client-v2/components/ListState.tsx
    - tests/e2e/v2-lists.spec.ts
    - tests/e2e/v2-hints.spec.ts
  modified:
    - src/client-v2/loan-view.ts
    - tests/unit/loan-view.test.ts
    - src/client-v2/App.tsx
    - src/client-v2/features/LoansSection.tsx
    - src/client-v2/features/BooksSection.tsx
    - src/client-v2/features/ReadersSection.tsx
    - tests/e2e/fake-api.ts
    - tests/e2e/v2-lock.spec.ts
    - tests/e2e/v2-outcome.spec.ts
    - docs/memory.md

key-decisions:
  - "Подпись таблицы стала именем таблицы (TableCaption), aria-label самой таблицы убран: имя контейнера прокрутки не совпадает с именем раздела-региона"
  - "Успешное перечитывание после действия переводит failed в ready: иначе таблицы навсегда остались бы «Данные не загружены» при уже прочитанных списках; в состояние loading раздел не возвращается никогда"
  - "Подсказки FR-6 только показывают числа (available, copies, активные выдачи по загруженному списку); лимит и срок в клиенте не появляются, «Выдать» не блокируется"
  - "Порядок выдач сравнивает ISO-строки без разбора дат; просрочка берётся из поля overdue"

requirements-completed: [HW4-3, FR-1, FR-2, FR-4, FR-6]

coverage:
  - id: D1
    description: "Просроченная выдача первая при любом порядке ответа; статус текстом и цветом; просроченная строка выделена целиком; «Вернуть» только у активных"
    requirement: FR-4
    verification:
      - kind: unit
        ref: "tests/unit/loan-view.test.ts: puts overdue loans first, then active by due date, then returned newest first; describes loan status in Russian"
        status: pass
      - kind: e2e
        ref: "tests/e2e/v2-lists.spec.ts: lists overdue loan first for any creation order"
        status: pass
    human_judgment: false
  - id: D2
    description: "Первая загрузка: «Загрузка…» вместо каждой таблицы и ни одного текста о пустом списке; затем таблицы или тексты пустых списков"
    requirement: FR-1
    verification:
      - kind: e2e
        ref: "tests/e2e/v2-lists.spec.ts: shows loading text without empty texts during first load"
        status: pass
    human_judgment: false
  - id: D3
    description: "Шесть текстов пустых списков дословно из ux-patterns.md (каталог, читатели, четыре случая выдач)"
    requirement: FR-1
    verification:
      - kind: e2e
        ref: "tests/e2e/v2-lists.spec.ts: shows loans empty text when ... (4), shows empty texts for books and readers after a successful load"
        status: pass
    human_judgment: false
  - id: D4
    description: "Сбой первой загрузки: один alert вверху, «Данные не загружены», API: недоступен, текстов о пустом списке нет, формы активны"
    requirement: FR-2
    verification:
      - kind: e2e
        ref: "tests/e2e/v2-lists.spec.ts: shows load failure at the top"
        status: pass
    human_judgment: false
  - id: D5
    description: "Таблица читателей с подписью и контейнером прокрутки"
    requirement: FR-1
    verification:
      - kind: e2e
        ref: "tests/e2e/v2-lists.spec.ts: shows readers as a table"
        status: pass
    human_judgment: false
  - id: D6
    description: "Подсказки «Свободно: N из M» и «На руках: N» через aria-describedby; пусто до выбора; «Выдать» активна при нуле свободных; лимит не показан; без живых ролей; кнопка не сдвигается"
    requirement: FR-6
    verification:
      - kind: e2e
        ref: "tests/e2e/v2-hints.spec.ts (5 сценариев)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Заморозка корня: src/client (кроме App.tsx), index.html, loans.spec.ts, smoke.spec.ts не изменены"
    requirement: HW4-3
    verification:
      - kind: command
        ref: "FREEZE из плана: код 0"
        status: pass
    human_judgment: false

duration: 9 min
completed: 2026-11-14
---

# Phase 7 Plan 05: списки и подсказки /v2/ Summary

Страница `/v2/` показывает выдачи в порядке FR-4 со статусом текстом и цветом, различает загрузку, пустой список и сбой, выводит читателей таблицей и подсказывает «Свободно: N из M» и «На руках: N», ничего не блокируя.

## Выполнено

- **Task 1 (tracer, tdd), 57456f4.** `orderLoans`, `activeLoanCount`, `loanStatus` по тестам; таблица выдач с колонкой «Статус», фоном `bg-danger-bg` у просроченной строки, `text-danger` и `text-text-muted` у статусов; `stubLists` в `fake-api.ts`; e2e порядка при перемешанном ответе. Сквозная проверка трассера прошла (15 из 15 Playwright), расширение продолжено.
- **Task 2, 0139ad8.** Состояние `load` в `App.tsx`, `ListState`, шесть пустых текстов, сбой, таблица читателей, 8 новых e2e в `v2-lists.spec.ts`.
- **Task 3, 186c534.** `Label` с `htmlFor`, `aria-describedby`, `FieldHint` с зарезервированной строкой, варианты «Выберите книгу» и «Выберите читателя», `v2-hints.spec.ts` (5), запись в `docs/memory.md`.

## Evidence: RED до правки кода

**Unit `loan-view` (до реализации функций):** `npx vitest run tests/unit/loan-view.test.ts`, итог `Tests 6 failed | 4 passed (10)`, причина `TypeError: loanStatus is not a function` и аналогично для `orderLoans`, `activeLoanCount`. После реализации: `10 passed`.

## Проверки (после Task 3)

- `npm run typecheck`, `npm run lint`, `npm run format:check`: чисто.
- Vitest: 603 теста, один красный, известный `format-and-lint hook script formats edited file in place with exit code 0` (было 597, плюс 6 тестов `loan-view`).
- Playwright: `v2-hints`, `v2-lists`, `v2-outcome`, `v2-lock`, `v2-shell`, `smoke`, `loans`: 32 из 32, с отдельным `LIBRARY_DATA_FILE`, порты 3000 и 5173 перед запуском свободны.
- Acceptance Task 1: в теле `orderLoans` нет `new Date`, `Date.now`, `Date.parse` (проверка `node -e` по исходнику); тест слоёв `client-v2-layers` зелёный в составе Vitest.
- Acceptance Task 2: шесть пустых текстов подтверждены дословно (`exact: true`); первая загрузка идёт под закрытыми воротами, тексты о пустом списке в этот момент отсутствуют.
- Acceptance Task 3: `v2-outcome.spec.ts` зелёный после смены подписей вариантов; верхняя запись `docs/memory.md` относится к плану 07-05.
- FREEZE: код 0.
- В `src/client-v2` нет новых `setTimeout`, `setInterval`; в e2e нет `waitForTimeout`.

## Deviations from Plan

**1. [Rule 3 - Blocking] В `v2-outcome.spec.ts` и `v2-lock.spec.ts` изменены локаторы таблиц.**
- **Found during:** Task 1
- **Issue:** план требует, чтобы именем таблицы была подпись `TableCaption` («Выдачи», «Книги»), а имя контейнера «Таблица выдач», «Таблица книг». До этого `Table` нёс `aria-label="Таблица выдач"` на самой таблице, и `getByRole('table', { name: 'Выдачи' })` не находил её.
- **Fix:** `Table containerLabel=... + TableCaption`; пять локаторов `getByRole('table', { name: 'Таблица ...' })` заменены на `name: 'Выдачи'` и `name: 'Книги'`. Проверки и тексты тестов не менялись.
- **Files modified:** `tests/e2e/v2-outcome.spec.ts`, `tests/e2e/v2-lock.spec.ts`, `BooksSection.tsx`, `LoansSection.tsx`
- **Commit:** 57456f4

**2. [Rule 2 - Missing critical] Добавлен файл `src/client-v2/components/ListState.tsx`, которого нет в `files_modified`.**
- **Found during:** Task 2
- **Issue:** выбор «Загрузка…» / «Данные не загружены» / пустой текст нужен трём разделам; без общего компонента логика копировалась бы трижды.
- **Fix:** общий компонент и тип `LoadState`; тексты без живых ролей.
- **Commit:** 0139ad8

**3. [Rule 1 - Bug] Успешное перечитывание списков после действия переводит `failed` в `ready`.**
- **Found during:** Task 2
- **Issue:** при сбое первой загрузки и последующем успешном действии списки читаются, но таблицы остались бы заменены «Данные не загружены». Формулировка плана «обновление после действия `load` не меняет» относится к возврату в `loading`, его не происходит.
- **Fix:** в `run()` после удачного `refresh()` выставляются `load: 'ready'` и `API: ok` (в демо `демо-данные`).
- **Commit:** 0139ad8

**4. [Rule 1 - Environment] Хук `format-and-lint` отвечает `spawnSync ... ENOENT` после каждой правки.** Prettier запускался вручную. Не дефект кода плана.

**5. [Process] Команда `python -` зависла на stdin, и heredoc после неё выполнился дважды** (после принудительного завершения процесса цепочка продолжилась). В `v2-lists.spec.ts` оказались дубли тестов; файл урезан до одного экземпляра до первого запуска и коммита. На итог не влияет.

**Total deviations:** 5 (1 blocking, 1 missing critical, 1 bug, 2 прочих). **Impact:** поведение плана выполнено; локаторы двух чужих e2e обновлены вслед за переименованием таблиц.

## Known Stubs

None. Все данные берутся из API (`/v2/`) или из подмены Playwright, в UI нет заглушек.

## Threat Flags

None. Новых сетевых точек и путей доступа к файлам нет, `src/server/**` и `src/domain/**` не менялись. Мера T-07-14 выполнена: `v2-hints.spec.ts` проверяет активную «Выдать» при нуле свободных и отсутствие «из 3»; T-07-15: только текстовые узлы JSX, сообщение сбоя из `errorMessage`.

## Self-Check: PASSED

- FOUND: src/client-v2/components/ListState.tsx, tests/e2e/v2-lists.spec.ts, tests/e2e/v2-hints.spec.ts, src/client-v2/loan-view.ts, tests/unit/loan-view.test.ts
- FOUND commits: 57456f4, 0139ad8, 186c534
