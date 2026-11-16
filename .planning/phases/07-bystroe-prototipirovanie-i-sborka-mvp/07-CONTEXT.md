# Phase 7: Быстрое прототипирование и сборка MVP - Context

**Gathered:** 2026-11-13
**Status:** Ready for planning
**Source:** решения автора в сессии 2026-11-13, без опроса `/gsd-discuss-phase` (так решил автор); журнал — `docs/memory.md`

<domain>
## Phase Boundary

ДЗ-4 (`docs/homework-4.md`): собрать UX и UI, применить библиотеки курса для прототипа и для MVP, разместить на хостинге. Результат — второй вариант интерфейса библиотекаря рядом с текущим: кликабельный прототип на демо-данных и MVP на настоящем API, сборка в Docker с nginx, публичная ссылка. Домен, API и формат `data/library.json` не меняются. Текущий интерфейс на `/` остаётся как есть.

</domain>

<decisions>
## Implementation Decisions

### Два варианта фронта
- **D-01:** Новый интерфейс — второй вариант фронта, а не замена. Текущий (`src/client/`, адрес `/`) замораживается: новых требований не получает, меняется только добавлением ссылки на новый вариант. `tests/e2e/loans.spec.ts` и `tests/e2e/smoke.spec.ts` не правятся и продолжают ходить на `/`.
- **D-02:** Адреса: `/prototype/` — прототип, `/v2/` — MVP. Это три точки входа Vite (многостраничная сборка), библиотека маршрутизации не добавляется. Код нового варианта — в `src/client-v2/`; у старого берётся только `src/client/api.ts` (типы и клиент API).
- **D-03:** Между вариантами переключают ссылки в подвале каждой страницы.
- **D-04:** NFR-3 (без новых зависимостей, CSS не больше 20 КБ) действует только для `/`. Для `/prototype/` и `/v2/` остаётся правило «цвета и отступы только из токенов `DESIGN.md`». Записано в `docs/handoff/prd.md`, раздел «Ограничения».

### Библиотеки
- **D-05:** Берём Tailwind 4, shadcn/ui (основа Radix, стиль `radix-nova`), `lucide-react` как единственный набор иконок, Motion. Образцы таблицы и пустого состояния можно смотреть на 21st.dev.
- **D-06:** Не берём: TailArk (секции лендинга, лендинг не делаем), GSAP, Design OS (видение, сущности, токены и экраны уже есть после ДЗ-3), UI/UX Pro Max (направление, палитра и шрифт выбраны автором). Отказ объясняется одной строкой в README «Модуль 4».
- **D-07:** Анимации разрешены только в `/prototype/` и `/v2/`; это исключение из правила «анимаций нет» записывается в `DESIGN.md`. Учитывается `prefers-reduced-motion`. На `/` анимаций по-прежнему нет.

### Дизайн
- **D-08:** Визуальная система — `DESIGN.md`: палитра автора, IBM Plex Sans, отступы, состояния. Его токены сопоставляются семантическим токенам shadcn (`primary`, `primary-foreground`, `muted`, `destructive`, `border`, `ring`, `radius`), таблица соответствия и раздел «История изменений» добавляются в `DESIGN.md`. Шрифт Geist, который ставит `shadcn init`, убирается. Тёмной темы нет.
- **D-09:** Экраны, состояния и тексты — по `docs/handoff/ux-patterns.md` и макету `docs/mockups/main-screen.html` (восемь состояний). Решения D-01..D-14 фазы 6 действуют для нового варианта, кроме запрета анимаций.

### Прототип и MVP
- **D-10:** Прототип работает без сервера: адаптер API в памяти браузера с демо-данными. Содержание — демо-данные, настоящих названий и контактов нет. Показывает восемь состояний макета, основной сценарий прокликивается.
- **D-11:** MVP — те же компоненты на настоящем API. FR-1..FR-6, NFR-1, NFR-2 закрываются через TDD по планам фазы 6: `06-01` и `06-02` (поведение) берутся почти как есть с адресом `/v2/`, `06-03` (стили) переписывается под Tailwind и shadcn, `06-04` (приёмка) правится — проверка размера CSS убирается, остаётся тест «цвета только из токенов».
- **D-12:** Список выбора — нативный `<select>` (компонент `native-select`), а не Select на Radix. На странице один `role="alert"` и только для отказа; подтверждения идут через `role="status"`, для них нужна своя обёртка: `alert.tsx` из shadcn всегда ставит `role="alert"`.
- **D-13:** В приёмку шагов входит чек-лист перед показом: окно инкогнито, 375 px без горизонтальной прокрутки, заголовок вкладки, консоль без ошибок, нет 404.

### Выкладка
- **D-14:** Приложение разворачивается в Docker: nginx отдаёт собранную статику и проксирует `/api` в контейнер Node. `data/library.json` лежит на томе; при пустом томе копируется файл с демо-данными в текущем формате хранилища.
- **D-15:** Хостинг автор выберет позднее. Без публичной ссылки пункт 4 ДЗ не закрыт. Предложение, ещё не решение: прототип (чистая статика) на Vercel, MVP в Docker на TimeWeb Cloud.

### Среда
- **D-16:** Работа ведётся в копии на Windows (`C:\MY\projects2\library`), Node 24.22.1 через NVM for Windows. Исправление `.claude/hooks/format-and-lint.ts` под Windows автор отложил: `npm run check` на Windows красный на одном тесте этого hook, форматирование запускается вручную через `npm run format`.

### Claude's Discretion
- Структура файлов внутри `src/client-v2/`, состав и разбиение компонентов.
- Где и какие анимации Motion использовать в пределах D-07.
- Устройство адаптера демо-данных и состав демо-данных.
- Детали `Dockerfile`, `docker-compose.yml` и конфигурации nginx.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `docs/homework-4.md` — текст задания
- `docs/memory.md`, записи 2026-11-13 — решения, проверка библиотек, ловушки
- `docs/handoff/context.md` — карта документов, состояние кода, ограничения из e2e
- `docs/handoff/prd.md` — требования FR-1..FR-6, NFR-1..NFR-3, ограничения, область NFR-3
- `docs/handoff/user-stories.md`, `docs/handoff/ux-patterns.md` — истории, состояния, тексты
- `DESIGN.md` — визуальная система
- `docs/mockups/main-screen.html` — статичный макет восьми состояний
- `.planning/phases/06-produktovaya-analitika-i-vizualnaya-kontseptsiya/06-CONTEXT.md` и `06-01`..`06-04-PLAN.md` — решения и планы, которые берутся в основу `/v2/`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/client/api.ts`: типы `BookView`, `ReaderView`, `LoanView`, клиент `api`, `errorMessage`. Адаптер демо-данных должен повторять форму объекта `api`.
- `src/server/repository.ts`: интерфейс `LibraryRepository`; `src/server/index.ts` читает путь к данным из `LIBRARY_DATA_FILE` и порт из `PORT` — этого хватает для контейнера.

### Established Patterns
- Запуск сервера: `tsx src/server/index.ts`; сборка клиента: `vite build` в `dist/client`.
- Vite проксирует `/api` на `http://localhost:3000`; в контейнере эту роль берёт nginx.

### Integration Points
- `vite.config.ts`: добавить плагин `@tailwindcss/vite`, псевдоним `@` на `src/client-v2`, точки входа `prototype/index.html` и `v2/index.html`.
- `tsconfig.json`: `paths` для `@/*`.
- `eslint.config.js`, Prettier: сгенерированные shadcn файлы проходят `tsc` и ESLint, но не Prettier — после каждого `shadcn add` нужен `npm run format`.

### Проверено 2026-11-13 в копии проекта вне репозитория
- `shadcn@4.23.0 init -y -b radix -p nova` с Vite 8.3.4, TypeScript 6.0.3, React 19.3.1, Tailwind 4.3.5: проходит, если заранее есть CSS с `@import 'tailwindcss'`, плагин Vite и псевдоним.
- `shadcn add button input label card table alert native-select`: ставится; `tsc`, `eslint`, `vite build` с двумя точками входа проходят.
- `init` добавляет зависимости `radix-ui`, `class-variance-authority`, `cn`, `lucide-react`, `tw-animate-css`, `shadcn`, `@fontsource-variable/geist` (последнюю убрать).

</code_context>

<specifics>
## Specific Ideas

История для проверяющего: `/` — интерфейс «до», `/v2/` — «после», `/prototype/` — прототип на тех же компонентах. Критерий ДЗ «собран фронт прототипов и MVP» закрывают две отдельные страницы.

</specifics>

<deferred>
## Deferred Ideas

- Выбор хостинга (D-15).
- Исправление hook `format-and-lint` под Windows (D-16).
- Лендинг библиотеки для читателей отдельным проектом: обсуждался и отклонён автором.
- Постоянное хранилище вместо JSON-файла (Supabase из модуля 5) — следующее ДЗ.

</deferred>
