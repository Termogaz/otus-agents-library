---
phase: 07-bystroe-prototipirovanie-i-sborka-mvp
plan: 06
subsystem: client-v2-layout-motion-links
tags: [tailwind, motion, shadcn-table, playwright, variant-links]
status: complete

requires:
  - phase: 07-bystroe-prototipirovanie-i-sborka-mvp
    provides: "07-05 (списки, ListState, подсказки, stubLists), 07-10 (shadcn-компоненты на токенах DESIGN.md, motion 14.14.0)"
provides:
  - "Раскладка /v2/ по DESIGN.md: «Выдачи» на всю ширину, «Книги» и «Читатели» 5:3 от 768 px, перестроенная таблица выдач ниже 768 px (D-14)"
  - "Анимации входа Motion по исключению D-07: сообщение, строка новой выдачи, таблица после пустого текста; без exit; при reduce длительность 0"
  - "DESIGN.md: исключение про анимации в /prototype/ и /v2/ и запись в «История изменений»"
  - "components/VariantFooter.tsx и подвал со ссылками между /, /v2/, /prototype/ (D-03), VITE_APP_ORIGIN"
affects: [07-07, 07-08, 07-09]

actuals:
  tokens: 21000
  tasks: 3
  commits: 3

plan_head_before: 186c5347819bb32dde6450706f6a0afc1a6e0e5e
plan_head_after: 8353ffd2aef65aae19899c50179672910d6ddfac
commits: 3

tech-stack:
  added: []
  patterns:
    - "Узкая таблица выдач: CSS-сетка с order внутри @container, правила вне слоя Tailwind, явные ARIA-роли у таблицы"
    - "LazyMotion strict и MotionConfig reducedMotion=user в корне App; m.create(Alert) и m.create(TableRow); initial=false плюс duration 0 при reduce"
    - "Outcome.id как ключ MotionAlert: новый итог входит заново, старый исчезает сразу"
    - "firstLoadIds в LoansSection: строки первой загрузки без анимации"

key-files:
  created:
    - src/client-v2/components/VariantFooter.tsx
    - tests/e2e/v2-layout.spec.ts
    - tests/e2e/v2-motion.spec.ts
    - tests/e2e/variant-links.spec.ts
  modified:
    - src/client-v2/App.tsx
    - src/client-v2/styles.css
    - src/client-v2/components/StatusMessage.tsx
    - src/client-v2/components/ListState.tsx
    - src/client-v2/features/LoansSection.tsx
    - src/client-v2/features/BooksSection.tsx
    - src/client-v2/features/ReadersSection.tsx
    - src/client-v2/vite-env.d.ts
    - src/client-v2/v2/main.tsx
    - src/client-v2/prototype/main.tsx
    - src/client/App.tsx
    - DESIGN.md
    - docs/memory.md

key-decisions:
  - "Колонки узкой таблицы выдач: Книга, Статус, Действие, Читатель, Вернуть до, Выдана; заголовок «Срок» переименован в «Вернуть до», «Выдана» оставлена последней"
  - "Фон у строк и ячеек задан явно (bg-surface либо bg-danger-bg): иначе вычисленный цвет прозрачный и палитру нельзя проверить"
  - "Без AnimatePresence и exit: два alert в DOM ломают строгие локаторы; старый итог исчезает сразу, новый проявляется"
  - "reducedMotion=user отключает только сдвиг, поэтому при useReducedMotion() ещё initial=false и длительность 0"
  - "VITE_APP_ORIGIN применяется к ссылкам на / и /v2/, ссылка на /prototype/ относительная"

requirements-completed: [HW4-1, HW4-3, NFR-1, NFR-2]

coverage:
  - id: D1
    description: "Раскладка по DESIGN.md: «Выдачи» на всю ширину, «Книги» и «Читатели» 5:3 от 768 px, столбцом ниже; без горизонтальной прокрутки страницы от 360 до 1440 px"
    requirement: NFR-1
    verification:
      - kind: e2e
        ref: "tests/e2e/v2-layout.spec.ts: has no page horizontal scroll from 360 to 1440 px, places loans full width and books to readers as 5 to 3"
        status: pass
    human_judgment: false
  - id: D2
    description: "При 390 px статус и «Вернуть» видны без прокрутки, порядок колонок D-14, на широком экране порядок как в разметке"
    requirement: NFR-1
    verification:
      - kind: e2e
        ref: "tests/e2e/v2-layout.spec.ts: keeps status and return visible on narrow screen"
        status: pass
    human_judgment: false
  - id: D3
    description: "Цвета только из токенов DESIGN.md, строки не ниже 44 px, контур фокуса, серая заблокированная кнопка"
    requirement: NFR-2
    verification:
      - kind: e2e
        ref: "tests/e2e/v2-layout.spec.ts: uses DESIGN.md colors, keeps table rows at least 44 px high, shows keyboard focus outline, greys out locked return button"
        status: pass
    human_judgment: false
  - id: D4
    description: "Анимации входа: один alert при быстрых отказах, без наложения alert и status, при reduce итог сразу opacity 1 и transform none, на / анимаций нет"
    requirement: HW4-3
    verification:
      - kind: e2e
        ref: "tests/e2e/v2-motion.spec.ts (4 сценария)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Ссылки между тремя вариантами со страниц /, /v2/, /prototype/, aria-current у текущего, снимки в test-results/hw4/"
    requirement: HW4-1
    verification:
      - kind: e2e
        ref: "tests/e2e/variant-links.spec.ts (4 сценария)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Заморозка корня: src/client (кроме добавленных строк App.tsx), index.html, loans.spec.ts, smoke.spec.ts не изменены"
    requirement: HW4-3
    verification:
      - kind: command
        ref: "FREEZE из плана: код 0; numstat src/client/App.tsx: 6 добавлено, 0 удалено"
        status: pass
    human_judgment: false

duration: 70 min
completed: 2026-11-14
---

# Phase 7 Plan 06: раскладка, анимации и ссылки между вариантами Summary

Страница `/v2/` собрана по DESIGN.md (сетка 5:3, перестроенная таблица выдач при 390 px, палитра и контуры по токенам), получила анимации входа Motion только по исключению D-07 без exit и с мгновенным итогом при reduce, а три варианта интерфейса связаны ссылками в подвалах.

## Выполнено

- **Task 1 (tracer), 9760063.** Карточки-регионы с отступами `p-4 md:p-6`; «Выдачи» над парой «Книги» и «Читатели» (`md:grid-cols-[minmax(0,5fr)_minmax(0,3fr)]`); таблица выдач в `@container` перестраивается ниже 768 px сеткой с `order` (первая колонка `calc(100cqw - 12.5rem)`), явные ARIA-роли возвращают семантику таблицы; явные фоны строк и ячеек; `v2-layout.spec.ts` (7 сценариев).
- **Task 2, 95f4617.** `MotionAlert = m.create(Alert)` с ключом `Outcome.id`; `MotionRow` для новых выдач; проявление таблицы после текста пустого списка в `ListState`; `LazyMotion strict` и `MotionConfig` в корне; DESIGN.md: исключение D-07 и строка истории; `v2-motion.spec.ts` (4).
- **Task 3, 8353ffd.** `VariantFooter` с `nav` «Варианты интерфейса» и `aria-current`; проп `variant` у `App`; подвал в оболочке `/prototype/`; в `src/client/App.tsx` добавлены 6 строк; `variant-links.spec.ts` (4) со снимками 1280 и 390 px в `test-results/hw4/`; запись в `docs/memory.md`.

## Проверки

- `npm run typecheck`, `npm run lint`, `npm run format:check`: чисто.
- Vitest: 603 теста, один красный, известный `format-and-lint hook script formats edited file in place with exit code 0` (D-16).
- Playwright: 47 из 47 по всем десяти спекам (`loans`, `smoke`, `v2-*`, `variant-links`), отдельный `LIBRARY_DATA_FILE`, порты 3000 и 5173 свободны.
- Разовая проверка анимации (временная спека, удалена до коммита): при вставке alert непрозрачность 0, через 400 мс 1.
- Acceptance Task 2: `node -e` по строкам импорта и JSX-атрибутам `src/client-v2`: компонентов ухода и атрибута `exit` нет.
- FREEZE: код 0; `git diff --numstat main -- src/client/App.tsx`: 6 добавленных, 0 удалённых строк.
- В `src/client-v2` нет новых `setTimeout`, `setInterval`; в e2e нет `waitForTimeout`.

## Deviations from Plan

**1. [Rule 1 - Bug] Колонка «Срок» переименована в «Вернуть до», порядок узкой таблицы дополнен «Выдана».**
- **Found during:** Task 1
- **Issue:** план перечисляет в узком порядке «Книга, Статус, Действие, Читатель, Вернуть до», а в таблице было шесть колонок с заголовком «Срок».
- **Fix:** заголовок стал «Вернуть до», «Выдана» осталась последней. Локаторы по имени «Срок» в других e2e не использовались.
- **Commit:** 9760063

**2. [Rule 1 - Bug] Строки и ячейки получили явный фон (`bg-surface` или `bg-danger-bg`).**
- **Found during:** Task 1
- **Issue:** тест палитры показал прозрачный вычисленный фон у обычных строк.
- **Fix:** общий класс `tint` у строки и ячеек.
- **Commit:** 9760063

**3. [Rule 2 - Missing critical] В `ListState.tsx`, `VariantFooter.tsx` и `prototype/main.tsx` внесены правки, которых нет в `files_modified` Task 2 и Task 3.**
- **Issue:** проявление таблицы после пустого текста живёт в общем `ListState`; тест «links from prototype» требует подвала на `/prototype/`, где пока оболочка 07-07; `v2/main.tsx` передаёт новый обязательный проп `variant`.
- **Fix:** подвал добавлен в оболочку прототипа (07-07 заменит её на `App` с `variant="prototype"`).
- **Commits:** 95f4617, 8353ffd

**4. [Rule 3 - Blocking] Локатор строки в `variant-links.spec.ts` сужен до таблицы «Выдачи».** Название книги встречалось и в таблице каталога (strict mode). Чужие тесты не менялись.

**5. [Rule 1 - Environment] Хук `format-and-lint` отвечает `spawnSync ... ENOENT` после каждой правки.** Prettier запускался вручную. Не дефект кода плана.

**6. [Process] Первая попытка скрипта правок через heredoc не выполнилась (ошибка разбора оболочки), файлы не менялись; правки сделаны инструментами Edit и Write.**

**Total deviations:** 6 (3 bug и окружение, 1 missing critical, 1 blocking, 1 process). **Impact:** поведение плана выполнено; чужие тесты не менялись.

## Known Stubs

Оболочка `/prototype/` (заголовок, строка «Прототип на демо-данных» и подвал) остаётся заглушкой плана 07-01; наполнение сделает 07-07. Цель этого плана (ссылки между вариантами, `/v2/`) заглушка не блокирует. Файл `src/client-v2/prototype/main.tsx`, строка с текстом «Прототип на демо-данных».

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: build-time link target | src/client-v2/components/VariantFooter.tsx | `VITE_APP_ORIGIN` подставляется в `href` ссылок на `/` и `/v2/`; значение задаёт автор при сборке, пользовательского ввода нет |

## Self-Check: PASSED

- FOUND: src/client-v2/components/VariantFooter.tsx, tests/e2e/v2-layout.spec.ts, tests/e2e/v2-motion.spec.ts, tests/e2e/variant-links.spec.ts
- FOUND commits: 9760063, 95f4617, 8353ffd
