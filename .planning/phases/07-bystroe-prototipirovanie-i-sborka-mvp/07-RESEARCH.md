# Phase 7: Быстрое прототипирование и сборка MVP - Research

**Researched:** 2026-11-14
**Domain:** второй фронт (Tailwind 4 + shadcn/ui + Motion) на Vite 8 с тремя точками входа; Docker + nginx; хостинг статики и контейнера
**Confidence:** MEDIUM (стек, токены, Vite, Motion, a11y, сборка сервера проверены в копии проекта; Docker, nginx и хостинг в этой сессии не запускались, тарифы и ограничения хостингов не подтверждены)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Два варианта фронта
- **D-01:** Новый интерфейс — второй вариант фронта, а не замена. Текущий (`src/client/`, адрес `/`) замораживается: новых требований не получает, меняется только добавлением ссылки на новый вариант. `tests/e2e/loans.spec.ts` и `tests/e2e/smoke.spec.ts` не правятся и продолжают ходить на `/`.
- **D-02:** Адреса: `/prototype/` — прототип, `/v2/` — MVP. Это три точки входа Vite (многостраничная сборка), библиотека маршрутизации не добавляется. Код нового варианта — в `src/client-v2/`; у старого берётся только `src/client/api.ts` (типы и клиент API).
- **D-03:** Между вариантами переключают ссылки в подвале каждой страницы.
- **D-04:** NFR-3 (без новых зависимостей, CSS не больше 20 КБ) действует только для `/`. Для `/prototype/` и `/v2/` остаётся правило «цвета и отступы только из токенов `DESIGN.md`». Записано в `docs/handoff/prd.md`, раздел «Ограничения».

#### Библиотеки
- **D-05:** Берём Tailwind 4, shadcn/ui (основа Radix, стиль `radix-nova`), `lucide-react` как единственный набор иконок, Motion. Образцы таблицы и пустого состояния можно смотреть на 21st.dev.
- **D-06:** Не берём: TailArk (секции лендинга, лендинг не делаем), GSAP, Design OS (видение, сущности, токены и экраны уже есть после ДЗ-3), UI/UX Pro Max (направление, палитра и шрифт выбраны автором). Отказ объясняется одной строкой в README «Модуль 4».
- **D-07:** Анимации разрешены только в `/prototype/` и `/v2/`; это исключение из правила «анимаций нет» записывается в `DESIGN.md`. Учитывается `prefers-reduced-motion`. На `/` анимаций по-прежнему нет.

#### Дизайн
- **D-08:** Визуальная система — `DESIGN.md`: палитра автора, IBM Plex Sans, отступы, состояния. Его токены сопоставляются семантическим токенам shadcn (`primary`, `primary-foreground`, `muted`, `destructive`, `border`, `ring`, `radius`), таблица соответствия и раздел «История изменений» добавляются в `DESIGN.md`. Шрифт Geist, который ставит `shadcn init`, убирается. Тёмной темы нет.
- **D-09:** Экраны, состояния и тексты — по `docs/handoff/ux-patterns.md` и макету `docs/mockups/main-screen.html` (восемь состояний). Решения D-01..D-14 фазы 6 действуют для нового варианта, кроме запрета анимаций.

#### Прототип и MVP
- **D-10:** Прототип работает без сервера: адаптер API в памяти браузера с демо-данными. Содержание — демо-данные, настоящих названий и контактов нет. Показывает восемь состояний макета, основной сценарий прокликивается.
- **D-11:** MVP — те же компоненты на настоящем API. FR-1..FR-6, NFR-1, NFR-2 закрываются через TDD по планам фазы 6: `06-01` и `06-02` (поведение) берутся почти как есть с адресом `/v2/`, `06-03` (стили) переписывается под Tailwind и shadcn, `06-04` (приёмка) правится — проверка размера CSS убирается, остаётся тест «цвета только из токенов».
- **D-12:** Список выбора — нативный `<select>` (компонент `native-select`), а не Select на Radix. На странице один `role="alert"` и только для отказа; подтверждения идут через `role="status"`, для них нужна своя обёртка: `alert.tsx` из shadcn всегда ставит `role="alert"`.
- **D-13:** В приёмку шагов входит чек-лист перед показом: окно инкогнито, 375 px без горизонтальной прокрутки, заголовок вкладки, консоль без ошибок, нет 404.

#### Выкладка
- **D-14:** Приложение разворачивается в Docker: nginx отдаёт собранную статику и проксирует `/api` в контейнер Node. `data/library.json` лежит на томе; при пустом томе копируется файл с демо-данными в текущем формате хранилища.
- **D-15:** Хостинг автор выберет позднее. Без публичной ссылки пункт 4 ДЗ не закрыт. Предложение, ещё не решение: прототип (чистая статика) на Vercel, MVP в Docker на TimeWeb Cloud.

#### Среда
- **D-16:** Работа ведётся в копии на Windows (`C:\MY\projects2\library`), Node 24.22.1 через NVM for Windows. Исправление `.claude/hooks/format-and-lint.ts` под Windows автор отложил: `npm run check` на Windows красный на одном тесте этого hook, форматирование запускается вручную через `npm run format`.

### Claude's Discretion
- Структура файлов внутри `src/client-v2/`, состав и разбиение компонентов.
- Где и какие анимации Motion использовать в пределах D-07.
- Устройство адаптера демо-данных и состав демо-данных.
- Детали `Dockerfile`, `docker-compose.yml` и конфигурации nginx.

### Deferred Ideas (OUT OF SCOPE)
- Выбор хостинга (D-15).
- Исправление hook `format-and-lint` под Windows (D-16).
- Лендинг библиотеки для читателей отдельным проектом: обсуждался и отклонён автором.
- Постоянное хранилище вместо JSON-файла (Supabase из модуля 5) — следующее ДЗ.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HW4-1 | Пункт 1 ДЗ: `DESIGN.md` сопоставляет токены с токенами shadcn/ui, содержит исключение про анимации | Раздел «Token mapping», таблица соответствия и список правок `DESIGN.md` в «Code Examples» |
| HW4-2 | Пункт 2 ДЗ: `/prototype/` на демо-данных в памяти браузера, восемь состояний | «Demo adapter», «Vite multi-page», хеш-состояния |
| HW4-3 | Пункт 3 ДЗ: `/v2/` на настоящем API, FR-1..FR-6 закрыты e2e, цвета из токенов, 390 px без горизонтальной прокрутки | «Accessibility contract», «Motion», «Testing strategy», тест токенов |
| HW4-4 | Пункт 4 ДЗ: публичная ссылка и чек-лист перед показом | «Docker + nginx», «Hosting facts», Open Questions |
| FR-1 | «Загрузка…», пустой список после успешной загрузки, при ошибке текста о пустом списке нет | Планы 06-01/06-02, `fake-api.ts` (`createGate`, `stubLists`) |
| FR-2 | Отказ — `role="alert"` в разделе действия, не больше одного сообщения об ошибке | Motion + `AnimatePresence` ломает «один alert» → только вход без exit |
| FR-3 | Кнопка заблокирована, пока идёт запрос | Планы 06-01/06-02; shadcn `Button` `disabled:` стили |
| FR-4 | Статус текстом и цветом, порядок строк | `loan-view.ts` (`orderLoans`), токены `danger-*`, `Table` shadcn |
| FR-5 | `role="status"` с результатом, формы очищаются, «Сохранено, но список не обновился» | Своя обёртка `<Alert role="status">` (проверено) |
| FR-6 | «Свободно: N из M», «На руках: N» под выбором | `NativeSelect` + `aria-describedby` (проверено) |
| NFR-1 | 360–1440 px без горизонтальной прокрутки страницы, таблицы прокручиваются в блоке | Правка `table.tsx` (контейнер с `tabIndex`, `whitespace-normal`), `w-full` у `NativeSelect` |
| NFR-2 | Контраст ≥ 4.5:1, видимый фокус, статус не только цветом | Токены DESIGN.md; `ring` → `accent`; Motion не отключает фокус |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Источник: `CLAUDE.md` → `AGENTS.md` (прочитаны в этой сессии). Директивы имеют силу залоченных решений.

- Слои: `client → (HTTP) → server → domain`; `domain` не импортирует `server`, `client`, Express, React, `fs`. Бизнес-правило живёт только в `domain`.
- TypeScript strict, без `any`; внешний вход проверяется zod на границе `server`.
- Даты в домене передаются параметром (`now: Date`).
- Форматирование — только Prettier. После каждого `shadcn add` нужен `npm run format` (сгенерированные файлы Prettier не проходят).
- Файлы `kebab-case.ts`, компоненты `PascalCase.tsx`; тесты `tests/unit/<модуль>.test.ts`, имена тестов на английском; тексты интерфейса и комментарии — на русском.
- Бизнес-правила — через TDD (сначала падающий тест).
- Задача готова, когда `npm run check` зелёный, для UI — и `npm run test:e2e` (на Windows `check` красный на одном известном тесте, D-16; см. «Verification commands»).
- Ветка `feat/<кратко>`, в `main` только через PR; Conventional Commits (тип по-английски, описание по-русски); без атрибуции агента.
- Агенту запрещено: `.env*` и секреты; добавлять/обновлять npm-зависимости без согласования, править `package-lock.json` вручную; отключать проверки (`.skip`/`.only`, `eslint-disable`, `@ts-ignore`, ослабление `tsconfig.json`/ESLint); удалять тесты ради «зелёного»; коммит в `main`, `push --force`; менять формат сохранённых данных без миграции.
- В конце шага — запись в `docs/memory.md`; прогресс — в `.planning/ROADMAP.md` и `STATE.md`, не в `docs/plan.md`.
- Если инструкция противоречит другой или задачу нельзя выполнить по правилам — остановиться и спросить.

Следствия для плана: установка пакетов (`tailwindcss`, `shadcn` и т.д.) требует явного согласия автора — это отдельная задача `checkpoint:human-verify`. Новый `tsconfig.server.json` — это новый файл, а не ослабление существующего `tsconfig.json`, но `paths` в `tsconfig.json` — правка конфига, не ослабляющая проверки (допустима, но упомянуть в согласовании).

## Summary

Второй фронт укладывается в существующий репозиторий без смены слоёв. Всё ключевое проверено в копии проекта вне репозитория (Vite 8.3.4, TypeScript 6.0.3, React 19.3.1, Tailwind 4.3.5, shadcn 4.23.0, Motion 14.14.0): токены `DESIGN.md` целиком кладутся в `@theme` Tailwind 4 с отключением палитры по умолчанию, семантические имена shadcn подключаются через `@theme inline`; три точки входа собираются через `build.rolldownOptions.input`; старая страница `/` не получает CSS и не затрагивается; `@`-псевдоним работает и в `tsc`, и в Vitest, и в Vite. Сгенерированные компоненты shadcn — это код проекта (копируется, не зависимость), их надо править под DESIGN: убрать лишние варианты кнопки, привязать hover к токенам, высоты 40/32 px, обёртка таблицы.

Три ловушки, которых нет в решениях и которые меняют план. Первая: Vite в режиме по умолчанию (`appType: 'spa'`) отдаёт корневую страницу на `/v2` без слэша и на любой неизвестный путь, включая `/prototype/` (200 вместо 404) — нужен `appType: 'mpa'` и ссылки со слэшем. Вторая: `AnimatePresence` с exit-анимацией держит старый `role="alert"` в DOM, и существующий стиль e2e (`getByRole('alert')` с `toHaveText`) падает за миллисекунды со `strict mode violation` — для сообщений `alert`/`status` анимируется только вход. Третья: сервер нельзя запускать нативно через Node type stripping (`ERR_MODULE_NOT_FOUND`, импорты без расширений) — в контейнер нужен либо `tsx` (минимум), либо `tsc`-сборка в `dist/api` (рекомендация).

Запуск на Windows: `npm run check` красный из-за одного заведомо известного теста hook (D-16); честная проверка — запуск Vitest с JSON-отчётом и проверка, что единственный упавший тест — именно известный. Docker CLI установлен, демон не запущен, поэтому всё про Docker/nginx не прогонялось: план обязан содержать контрольные точки запуска у автора. Хостинг (D-15): фактов недостаточно для решения без проверки на сайтах провайдеров; для MVP с томом надёжнее VPS с Docker, чем PaaS.

**Primary recommendation:** Начать с Wave 0 — согласование и установка зависимостей, `@theme`-токены + тест «цвета только из токенов», `appType: 'mpa'` с тремя входами, правка сгенерированных компонентов; затем TDD поведения `/v2/` по планам 06-01/06-02, затем прототип на том же наборе компонентов с адаптером демо-данных, затем Docker.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Отрисовка страниц `/v2/` и `/prototype/`, состояния, анимации входа | Browser / Client | — | Чистый React; анимации только на клиенте, `prefers-reduced-motion` читает браузер |
| Демо-данные и «API» прототипа | Browser / Client | — | D-10: адаптер в памяти браузера, сервер не нужен |
| Правила выдачи (лимит, срок, доступность) | API / Backend (`domain`) | Browser (только для прототипа, через чистые функции домена) | Правило живёт в `domain`; MVP спрашивает сервер, прототип может вызывать те же чистые функции (Open Question Q1) |
| Валидация входа, коды отказов | API / Backend | — | zod на границе `server`, `4xx` с кодом |
| Хранение `data/library.json` | Database / Storage (файл на томе) | API / Backend | Репозиторий за интерфейсом; в контейнере файл на именованном томе |
| Раздача статики (`/`, `/v2/`, `/prototype/`, `/assets`) | CDN / Static (nginx) | — | nginx отдаёт `dist/client`; кэш хешированных ассетов |
| Прокси `/api` | CDN / Static (nginx) | API / Backend | nginx — единственная публичная точка входа, Node-контейнер наружу не открыт |
| Токены и тема | Browser / Client (CSS на этапе сборки Tailwind) | — | Сборочный CSS; тёмной темы нет |
| Хостинг и HTTPS | Внешний провайдер | — | Vercel (статика) и/или VPS/PaaS TimeWeb; решение автора (D-15) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tailwindcss | 4.3.5 (publish 2026-11-06) | Утилитарный CSS, токены через `@theme` | Решение D-05 [VERIFIED: trial install 2026-11-13] |
| @tailwindcss/vite | 4.3.5 (та же линия) | Плагин Vite для Tailwind 4 | `shadcn init` распознаёт Vite + Tailwind 4 только с ним [VERIFIED: trial install 2026-11-13] |
| shadcn (CLI) | 4.23.0 (publish 2026-10-27) | Копирует компоненты в проект (`radix-nova`) | D-05; компоненты принадлежат проекту [VERIFIED: trial install 2026-11-13] |
| radix-ui | из `shadcn init` | Примитивы Radix | Зависимость компонентов (в нашем наборе почти не используется: `Label`, `Slot`) [VERIFIED: trial install 2026-11-13] |
| class-variance-authority | из `shadcn init` | Варианты кнопки/алерта | Зависимость компонентов [VERIFIED: trial install 2026-11-13] |
| cn | из `shadcn init` (publish 2026-11-02, репозиторий `shadcn-ui/cn`, 21.8M/нед) | `cn()` для `lib/utils.ts` (`export { cn } from "cn"`) | `shadcn@4.23.0` генерирует импорт из пакета `cn` [VERIFIED: trial install 2026-11-13] |
| lucide-react | из `shadcn init` (publish 2026-11-11) | Единственный набор иконок (D-05) | D-05 |
| tw-animate-css | из `shadcn init` | Утилиты анимации для компонентов shadcn | Подключается `@import 'tw-animate-css'` [VERIFIED: trial install 2026-11-13] |
| motion | 14.14.0 (publish 2026-11-13) | Анимации входа, `MotionConfig reducedMotion="user"` | D-05; импорт `motion/react`; peer `react`/`react-dom` опциональны, зависит от `framer-motion 14.14.0` [VERIFIED: `npm view`, trial install 2026-11-13] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@fontsource-variable/geist` | — | Шрифт, который ставит `shadcn init` | НЕ ставить/удалить (D-08); шрифт IBM Plex Sans подключается через `<link>` Google Fonts в каждой HTML-точке входа |
| Vitest `resolve.alias` | Vitest 5.0.5 (уже в проекте) | Тот же `@`-псевдоним в юнит-тестах | Тесты `src/client-v2/**` без отдельной конфигурации [VERIFIED: trial, `tests/unit/alias.test.ts` с `@/lib/utils` прошёл] |
| `@playwright/test` | 1.64 (уже в проекте) | e2e `/v2/` | Новые спеки `tests/e2e/v2-*.spec.ts`; старые не трогаются |
| `typescript` (`tsc -p tsconfig.server.json`) | 6.0.3 (уже в проекте) | Сборка сервера в JS для контейнера | Рекомендация B для Docker (см. ниже) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `tsc`-сборка сервера (B) | `npm ci` + `tsx` в контейнере (A) | A проще (ноль новых файлов, `CMD tsx src/server/index.ts`), но тянет `tsx`+`esbuild` (~13 МБ) и dev-зависимости; B даёт чистый `node dist/...` и `npm ci --omit=dev`. Нативный `node src/server/index.ts` не работает (проверено) |
| Полный `motion` | `LazyMotion` + `m` + `domAnimation` | Меньше в v2-чанке на ~57 КБ (87 против 144 КБ, gzip 31 против 49), но без `layout`; для D-07 хватает — см. «Motion» |
| `shadcn` `Select` (Radix) | `NativeSelect` | Решено D-12 |
| Vercel для всего | Vercel (прототип) + VPS (MVP) | см. «Hosting facts» |

**Installation:** (только после согласия автора, AGENTS.md; в этой фазе исследования ничего не ставилось)
```bash
export PATH="/c/nvm4w/nodejs:$PATH"
npm install tailwindcss @tailwindcss/vite motion
npx shadcn@4.23.0 init -y -b radix -p nova   # затем удалить Geist, см. Pitfall 6
npx shadcn@4.23.0 add button input label card table alert native-select
npm run format
```

**Version verification:** версии получены `npm view <pkg> version` и пробной установкой 2026-11-13/14; зависимости `radix-ui`, `class-variance-authority`, `cn`, `lucide-react`, `tw-animate-css`, `shadcn` добавляет `shadcn init`. Планировщик фиксирует точные версии из `package-lock.json` после установки.

## Package Legitimacy Audit

Проверено `gsd-tools query package-legitimacy check --ecosystem npm ...` 2026-11-13. Скриптов `postinstall` ни у одного пакета нет (`npm view <pkg> scripts.postinstall` пусто). Вердикт SUS у шести пакетов выставлен по единственной причине `too-new`: последняя версия опубликована в последние дни; у всех огромное число скачиваний и официальный репозиторий.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| tailwindcss | npm | годы (4.3.5 от 2026-11-06) | десятки млн/нед | github.com/tailwindlabs/tailwindcss | SUS (too-new) | Flagged — planner must add checkpoint |
| @tailwindcss/vite | npm | годы | десятки млн/нед | github.com/tailwindlabs/tailwindcss | SUS (too-new) | Flagged — planner must add checkpoint |
| shadcn | npm | годы (последняя 2026-10-27) | миллионы/нед | github.com/shadcn-ui/ui | SUS (too-new) | Flagged — planner must add checkpoint |
| cn | npm | пакет `cn` от shadcn (последняя 2026-11-02) | 21.8M/нед | github.com/shadcn-ui/cn | SUS (too-new) | Flagged — planner must add checkpoint |
| lucide-react | npm | годы (последняя 2026-11-11) | десятки млн/нед | github.com/lucide-icons/lucide | SUS (too-new) | Flagged — planner must add checkpoint |
| motion | npm | годы (14.14.0 от 2026-11-13) | миллионы/нед | github.com/motiondivision/motion | SUS (too-new) | Flagged — planner must add checkpoint |
| radix-ui | npm | годы | миллионы/нед | github.com/radix-ui/primitives | OK | Approved |
| class-variance-authority | npm | годы | десятки млн/нед | github.com/joe-bell/cva | OK | Approved |
| tw-animate-css | npm | годы | миллионы/нед | github.com/Wombosvideo/tw-animate-css | OK | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** `tailwindcss`, `@tailwindcss/vite`, `shadcn`, `cn`, `lucide-react`, `motion` — планировщик вставляет `checkpoint:human-verify` перед установкой. Он же закрывает требование AGENTS.md «зависимости только с согласования автора»: одна контрольная точка «показать автору список пакетов и версии, получить согласие, затем `npm install`». Рекомендация: ставить с точными версиями из этой таблицы, а не «последней» (новые версии вышли за последние дни).

`[ASSUMED]`-пометки для имён пакетов не нужны: все имена названы в CONTEXT.md (решение автора, проверено пробной установкой) и подтверждены официальными документами/установкой.

## Architecture Patterns

### System Architecture Diagram

```
                         ┌───────────────────────── Browser ─────────────────────────┐
   /  (замороженный)     │  src/client/main.tsx ── (без CSS, без анимаций)            │
   /v2/   (MVP)          │  src/client-v2/v2/main.tsx ─► <App> ─► api (src/client/api.ts)
   /prototype/           │  src/client-v2/prototype/main.tsx ─► <App> ─► demoApi (память)
                         │      │ общие компоненты (shadcn + свои) + styles.css (Tailwind @theme)
                         │      └─► MotionConfig reducedMotion="user" ─► вход сообщений/строк
                         └───────────────┬────────────────────────────────────────────┘
                                         │ fetch /api/*   (только /v2/ и /)
                                         ▼
 dev:  Vite :5173 ── proxy /api ───────────────────────────────┐
 prod: nginx :80  ── location /api ── proxy_pass ──► node :3000 │
        │  location /       ── try_files $uri $uri/ =404       │
        │  /assets          ── Cache-Control immutable          ▼
        └─ статика dist/client                      Express 5 + zod (src/server)
                                                      │  разобрать вход → вызвать domain → сохранить
                                                      ▼
                                              src/domain (чистые функции, now: Date)
                                                      │
                                                      ▼
                                       JsonFileRepository ─► LIBRARY_DATA_FILE
                                                             (том /app/data/library.json;
                                                              пустой том ◄── cp data/seed.json)
```

### Recommended Project Structure
```
src/
├── client/                     # замороженный вариант (/): только ссылка на /v2/ и /prototype/
├── client-v2/
│   ├── styles.css              # @import 'tailwindcss'; @theme с токенами DESIGN.md
│   ├── vite-env.d.ts           # /// <reference types="vite/client" /> (CSS-импорты под TS 6)
│   ├── lib/utils.ts            # cn (сгенерирован shadcn)
│   ├── components/ui/          # сгенерированные и ПРАВЛЕННЫЕ shadcn-компоненты
│   ├── components/             # свои: StatusMessage (status/alert), LoansTable, VariantFooter…
│   ├── features/               # LoansSection, BooksSection, ReadersSection (общие для v2 и prototype)
│   ├── loan-view.ts            # из плана 06-02: orderLoans, activeLoanCount (без импорта domain)
│   ├── app.tsx                 # <App api={...}> — api передаётся пропсом
│   ├── v2/main.tsx             # реальный api
│   ├── prototype/main.tsx      # demoApi
│   └── demo/                   # demo-api.ts, demo-data.ts (ЕДИНСТВЕННОЕ место, где можно импортировать domain)
├── server/ domain/             # без изменений
v2/index.html  prototype/index.html   # точки входа Vite (в корне, рядом с index.html)
data/seed.json                  # демо-данные для пустого тома (имя разрешено в .gitignore)
tsconfig.server.json  Dockerfile  docker-compose.yml  docker/nginx.conf  .dockerignore
tests/unit/ tests/e2e/v2-*.spec.ts
```

Главное: `<App>` принимает `api` пропсом (тип `typeof api`). Тогда `/v2/` и `/prototype/` — одни и те же компоненты, отличается только адаптер (Specifics: «прототип на тех же компонентах»).

### Pattern 1: Токены DESIGN.md в Tailwind 4 + семантика shadcn
**What:** DESIGN-токены (hex, имена `--color-*`) целиком в `@theme` с `--color-*: initial` (палитра Tailwind отключена); семантические имена shadcn — в `@theme inline` ссылками на DESIGN-токены. [VERIFIED: trial build 2026-11-14]
**When to use:** единственный `styles.css` для обоих новых входов.
**Example:** см. «Code Examples → styles.css».

Проверенные факты:
- После `--color-*: initial` утилиты `bg-red-500`, `text-blue-600`, `bg-white`, `text-black` не генерируются; генерируются `bg-danger-bg`, `text-danger`, `bg-surface-muted`, `rounded-control`, `rounded-card`. Произвольные значения `bg-[#fff]` по-прежнему генерируются — их ловит только тест (Pitfall 2). [VERIFIED: trial build]
- Hex работает с модификаторами прозрачности: `bg-primary/80` компилируется в `#104911cc` + правило `@supports color-mix(in oklab, var(--color-accent) 80%, transparent)`. [VERIFIED: trial build]
- `--radius-lg: var(--radius-control)` и `--radius-xl: var(--radius-card)`: компоненты shadcn используют `rounded-lg` для контролов и `rounded-xl` для Card — получается `.rounded-lg{border-radius:var(--radius-control)}`. [VERIFIED: trial build]
- Переопределение `--text-lg`/`--text-xl` меняет и размеры Tailwind; надо добавить `--text-lg--line-height` и `--text-xl--line-height`. [VERIFIED: trial build]
- Шаги отступов по умолчанию 1/2/3/4/6/8 (4/8/12/16/24/32 px) совпадают с `--space-1..8` из DESIGN.md; сгенерированные компоненты используют шаги вне шкалы (`px-2.5`, `gap-1.5`, `p-5`) — править файлы и разрешить исключения в тесте токенов только если автор согласен. [VERIFIED: trial build]
- Конфликт имён: в DESIGN `--color-accent` — основной зелёный `#104911`, в shadcn `accent` — нейтральный фон наведения. В нашем наборе из семи компонентов `bg-accent` не используется (проверено grep по сгенерированным файлам), поэтому оставить DESIGN-значение и не определять shadcn-вариант; для hover использовать `accent-tint`. [VERIFIED: grep сгенерированных компонентов в trial]
- Кнопка из `radix-nova` содержит `hover:bg-primary/80` и варианты `secondary`, `destructive`, `link`, `outline` с `hover:bg-muted` (`muted` = `surface-muted #a8d5e2` — слишком насыщенно для hover); вариант `secondary` читает сырые переменные `var(--secondary)`, `var(--foreground)`, которых в нашей схеме нет. Решение: удалить неиспользуемые варианты, `default` → `hover:bg-accent-hover active:bg-accent-active`, `outline` → `hover:bg-accent-tint`. [VERIFIED: чтение `button.tsx` в trial]
- Тёмная тема: если убрать `@custom-variant dark`, утилиты `dark:` в сгенерированных компонентах компилируются в `@media (prefers-color-scheme: dark)` — тёмная тема включится по настройке ОС. Оставить `@custom-variant dark (&:is(.dark *));` (не совпадает никогда), блок `.dark {}`, переменные sidebar/chart и шрифт Geist удалить. [VERIFIED: trial build]

### Pattern 2: Три точки входа, один Vite
**What:** `build.rolldownOptions.input = { main: 'index.html', v2: 'v2/index.html', prototype: 'prototype/index.html' }`. В Vite 8 `build.rollupOptions` помечен `@deprecated Use rolldownOptions instead` (алиас). [VERIFIED: `node_modules/vite/dist/node/index.d.ts` в trial (строки ~948, 2904, 3626); сборка с `rolldownOptions` прошла]
**Dev:** `appType: 'mpa'`. С `spa` по умолчанию `/v2` без слэша молча отдаёт корневую страницу (заголовок «Библиотека», `src/client/main.tsx`), а неизвестные пути и `/prototype/` дают 200 со страницей `/`. С `mpa`: `/v2` → 404, `/v2/` → 200 с нужной страницей, неизвестный путь → 404, `/` не меняется. [VERIFIED: trial dev-сервер, `curl` 2026-11-14]
**Следствия:** все ссылки на варианты — со слэшем (`/v2/`, `/prototype/`); nginx сам обрабатывает редирект на слэш. Корневой `index.html` и `src/client/` не получают CSS: собранный `dist/client/index.html` без `<link rel=stylesheet>`, у `v2/index.html` свой CSS-чанк; общий чанк только `jsx-runtime`. [VERIFIED: trial build]
**Заголовки вкладок и шрифт:** `<title>` и `<link>` Google Fonts (preconnect + stylesheet) — в каждую новую HTML-точку входа. `src/client-v2/vite-env.d.ts` нужен для импорта `.css` под TypeScript 6 (TS2882, как в плане 06-03). [CITED: .planning/phases/06-.../06-03-PLAN.md]

### Pattern 3: Motion 14 только на входе, с `MotionConfig reducedMotion="user"`
**What/How:** импорт из `motion/react`; корень `<MotionConfig reducedMotion="user">`; анимации — вход сообщения (opacity + короткий сдвиг), вход строк таблицы, появление секции. Сообщения `role="alert"` и `role="status"` НЕ оборачиваются в `AnimatePresence` с exit. [VERIFIED: trial + Playwright 2026-11-14]
**Подробности и числа:** раздел «Motion 14 и Playwright».

### Pattern 4: Доступность поверх shadcn (проверено e2e-зондом)
**What:** контракт старого e2e-стиля сохраняется. Раздел «Accessibility contract».

### Pattern 5: `<App api>` и адаптер демо-данных
**What:** адаптер той же формы, что `api` из `src/client/api.ts`; состояние в памяти, сброс при перезагрузке. Раздел «Demo adapter».

### Anti-Patterns to Avoid
- **`AnimatePresence` с exit вокруг alert/status:** два alert в DOM → `strict mode violation` без повторных попыток. Анимировать только вход, ключ — id исхода.
- **Хардкод цветов и «магических» отступов в компонентах:** `bg-[#fff]`, `text-[#333]`, `p-[13px]` обходят `@theme`; ловить тестом.
- **Переиспользовать `src/client/styles`/CSS старой страницы в новых страницах:** у `/` CSS нет; общий CSS сломает NFR-3 для `/`.
- **Тянуть `layout`-анимации у строк таблицы:** клик по строке с активной `layout`-анимацией ждал стабильности ~899 мс (переход 0,5 с). Держать 150–300 мс или не использовать `layout`.
- **SPA-fallback в nginx** (`try_files ... /index.html`): скроет 404 и пропустит «нет 404» из чек-листа D-13.
- **Селектор Radix `Select`** (D-12) и `CardTitle` как заголовок: `CardTitle` — `div`, нужен настоящий `<h2>`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Утилиты классов, слияние Tailwind | собственный `cn` | `cn` из `shadcn init` | Конфликты классов решает пакет |
| Варианты кнопки/алерта | ручной `switch` по классам | `class-variance-authority` (уже в стеке) | Типизированные варианты |
| Анимация входа и `prefers-reduced-motion` | свой CSS keyframes + `matchMedia` | `motion` + `MotionConfig reducedMotion="user"` | Единая точка отключения transform/layout (opacity остаётся, см. ниже) |
| Иконки | свои SVG | `lucide-react` | D-05 |
| Мультистраничная сборка | свой роутер/плагин | `build.rolldownOptions.input` + `appType: 'mpa'` | D-02: библиотека маршрутизации не добавляется |
| Правила выдачи в прототипе | копия логики в `demo/` | чистые функции `src/domain/loans.ts` (`checkoutBook`, `returnBook`, `availableCopies`, `isOverdue`) или заранее заданные исходы (Q1) | Не дублировать бизнес-правило |
| Статика + прокси | Node-сервер, раздающий `dist/client` | nginx (D-14) | Готовое решение |
| Контрастность | ручная оценка «на глаз» | расчёт в `DESIGN.md` (уже есть) и тест токенов | NFR-2 |
| Сборка сервера в контейнер | ручной `node --experimental-strip-types` | `tsc -p tsconfig.server.json` или `tsx` | Нативный запуск `.ts` падает на импортах без расширений (проверено) |

**Key insight:** вся «хитрость» фазы — на стыках (токены ↔ сгенерированные компоненты, Motion ↔ контракт e2e, Vite ↔ nginx), а не в самих библиотеках; там самодельные решения дают тихие поломки.

## Common Pitfalls

### Pitfall 1: Vite dev отдаёт корневую страницу на любой путь
**What goes wrong:** открыв `/v2` или опечатку, разработчик видит старый интерфейс и думает, что новый «не отличается»; e2e на неверном пути проходит против `/`.
**Why:** `appType: 'spa'` по умолчанию. **How to avoid:** `appType: 'mpa'`, ссылки с `/v2/`, `/prototype/`; в e2e `expect(page).toHaveTitle(...)` для новой страницы. **Warning signs:** заголовок вкладки «Библиотека» на `/v2/`. [VERIFIED: trial]

### Pitfall 2: «Цвета только из токенов» не ловит произвольные значения
**What goes wrong:** `bg-[#fff]` и inline `style` проходят сборку. **How to avoid:** юнит-тест `tests/unit/css-tokens.test.ts` (переписать из плана 06-04), который сканирует `src/client-v2/**/*.{tsx,ts,css}` на `#hex`, `rgb(`, `hsl(`, `oklch(`, `\[#`, `-\[\d+px\]` вне `styles.css` блока `@theme`; в `styles.css` разрешены hex только внутри `@theme`. Список разрешённых исключений (off-scale шаги) — явный. [ASSUMED: форма теста; сама проблема VERIFIED в trial]

### Pitfall 3: Exit-анимация ломает «один role="alert»
**What goes wrong:** две быстрые ошибки → два `role="alert"` на время exit; `expect(getByRole('alert')).toHaveText('Нет свободных экземпляров')` падает за ~7–9 мс с `strict mode violation: getByRole('alert') resolved to 2 elements`, без повторных попыток. При переходе alert→status старый alert живёт рядом со status. **How to avoid:** без `exit`/`AnimatePresence` для сообщений; вход с ключом по id исхода; допустимая альтернатива `AnimatePresence mode="wait"` (один элемент в каждый момент). [VERIFIED: trial + Playwright]

### Pitfall 4: `toBeVisible` проходит посреди анимации (скриншоты «в полёте»)
**What goes wrong:** `toBeVisible`/`toBeInViewport` истинны при `opacity: 0.03`; скриншот выходит бледным. **How to avoid:** в скриншотных шагах и проверках стилей ждать `await expect(el).toHaveCSS('opacity', '1')`; клик по анимируемым элементам не требует отдельной защиты при длительностях ≤ 300 мс. [VERIFIED: trial + Playwright]

### Pitfall 5: `reducedMotion="user"` не отключает всё
**What goes wrong:** ожидание, что при `prefers-reduced-motion: reduce` исчезнет вся анимация; на деле отключаются transform и layout, а `opacity` и `backgroundColor` продолжают анимироваться (документация Motion). С эмуляцией Playwright `reducedMotion: 'reduce'` получен `transform: none` при ещё идущей анимации `opacity`. В dev Motion пишет `console.warn` про Reduced Motion при включённой эмуляции — это не ошибка, но чек-лист «консоль без ошибок» (D-13) смотреть на `console.error`. **How to avoid:** если нужна полностью статичная картинка при `reduce`, использовать `useReducedMotion()` и отдавать `duration: 0` для opacity; иначе зафиксировать в `DESIGN.md`, что при `reduce` остаётся только плавное проявление. [VERIFIED: trial; CITED: motion.dev/docs/react-motion-config]

### Pitfall 6: `shadcn init` приносит лишнее
**What goes wrong:** Geist (`@fontsource-variable/geist`), `@import 'shadcn/tailwind.css'`, блок `.dark`, sidebar/chart-переменные, `font-sans` на Geist; Prettier падает на всех сгенерированных файлах. **How to avoid:** после `init` удалить пакет Geist и строки шрифта (D-08), заменить блоки темы на `@theme` из примера, сразу `npm run format`. Заметка: `npm` (v11.19) предупреждает о заблокированных скриптах установки `esbuild` — безвредно. [VERIFIED: trial]

### Pitfall 7: Нативный запуск `.ts` в контейнере
**What goes wrong:** `node src/server/index.ts` → `ERR_MODULE_NOT_FOUND ... app.js imported from ... index.ts` (импорты в проекте без расширений и в стиле Bundler). **How to avoid:** `tsc`-сборка (рекомендация B) или `tsx` (A). [VERIFIED: запуск на Node 24.22.1 в этой сессии]

### Pitfall 8: Сборка сервера с `-p` вне проекта не видит типы Node
**What goes wrong:** `TS2688: Cannot find type definition file for 'node'`, если конфиг лежит вне корня проекта; JS при этом всё равно эмитится. **How to avoid:** `tsconfig.server.json` лежит в корне репозитория (extends `./tsconfig.json`). [VERIFIED: проба в scratchpad]

### Pitfall 9: Перенос строк и права в контейнере на Windows
**What goes wrong:** shell-скрипт `entrypoint.sh` с CRLF падает `exec ... no such file` (в проекте нет `.gitattributes`, `core.autocrlf=input`); bind-mount с Windows даёт чужие права на `data/`. **How to avoid:** без отдельного скрипта — инлайн `sh -c` в `CMD` или `.gitattributes` с `*.sh text eol=lf`; для данных — именованный том, а не bind-mount. [ASSUMED]

### Pitfall 11: Стартовые демо-данные «протухают»
**What goes wrong:** `data/seed.json` с абсолютными датами: выдача «на руках» со временем становится просроченной. **How to avoid:** в сид-файле только книги и читатели, выдач нет (Open Question Q4); просроченную выдачу показывает прототип, где даты считаются от `now`. [ASSUMED]

### Pitfall 10: Таблица shadcn ломает NFR-1 и контракт a11y
**What goes wrong:** `Table` оборачивает `<table>` в `div.overflow-x-auto` без `tabindex`/`role` (клавиатуру не прокрутить), у ячеек `whitespace-nowrap p-2` (на 390 px страница разъезжается), `TableCaption` визуально внизу и серый. **How to avoid:** править `table.tsx`: контейнер `role="region"` + `aria-label` + `tabIndex={0}` (или отдельный проп), `whitespace-normal` у ячеек, caption `sr-only`; `NativeSelect` обёртке `w-full` (по умолчанию `w-fit`, 146 px). [VERIFIED: чтение сгенерированных файлов и e2e-зонд в trial]

## Code Examples

Шаблоны ниже опираются на значения, прочитанные в этой сессии. Значения токенов DESIGN.md приведены дословно как прочитаны: `--color-bg #f2f9fb`, `--color-surface #ffffff`, `--color-surface-muted #a8d5e2`, `--color-text #1c2b1d`, `--color-text-muted #3f5244`, `--color-border #cfe3ea`, `--color-border-control #548c2f`, `--color-accent #104911`, `--color-accent-hover #0c3a0d`, `--color-accent-active #082b09`, `--color-accent-tint #e9f2e2`, `--color-on-accent #ffffff`, `--color-danger #7a4100`, `--color-danger-bg #fef0d9`, `--color-danger-border #f9a620`, `--color-warn-bg #ffd449`, `--color-warn-border #f9a620`, `--color-disabled-bg #e4ebe6`, `--color-disabled-text #566a5a`; `--text-sm/base/lg/xl` = 0.875/1/1.25/1.75rem; `--space-1..8` = 4/8/12/16/24/32px; `--radius-control 6px`, `--radius-card 10px`, `--control-height 40px`, `--button-compact-height 32px`, `--row-height 44px`, `--content-width 1120px`. [VERIFIED: DESIGN.md] Планировщик перед записью переносит значения из `DESIGN.md` заново, а не из этого файла.

### `src/client-v2/styles.css`
```css
/* Токены из DESIGN.md. Палитра Tailwind отключена: цвета только отсюда. */
@import 'tailwindcss';
@import 'tw-animate-css';

@custom-variant dark (&:is(.dark *)); /* не совпадает никогда: тёмной темы нет (D-08) */

@theme {
  --color-*: initial;

  --color-bg: #f2f9fb;
  --color-surface: #ffffff;
  --color-surface-muted: #a8d5e2;
  --color-text: #1c2b1d;
  --color-text-muted: #3f5244;
  --color-border: #cfe3ea;
  --color-border-control: #548c2f;
  --color-accent: #104911;
  --color-accent-hover: #0c3a0d;
  --color-accent-active: #082b09;
  --color-accent-tint: #e9f2e2;
  --color-on-accent: #ffffff;
  --color-danger: #7a4100;
  --color-danger-bg: #fef0d9;
  --color-danger-border: #f9a620;
  --color-warn-bg: #ffd449;
  --color-warn-border: #f9a620;
  --color-disabled-bg: #e4ebe6;
  --color-disabled-text: #566a5a;

  --font-sans: 'IBM Plex Sans', system-ui, sans-serif; /* стек — дословно из DESIGN.md */
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.25rem;
  --text-lg--line-height: 1.3;
  --text-xl: 1.75rem;
  --text-xl--line-height: 1.2;
  --radius-control: 6px;
  --radius-card: 10px;
}

/* Имена shadcn → токены DESIGN.md (таблица соответствия идёт в DESIGN.md) */
@theme inline {
  --color-background: var(--color-bg);
  --color-foreground: var(--color-text);
  --color-card: var(--color-surface);
  --color-card-foreground: var(--color-text);
  --color-primary: var(--color-accent);
  --color-primary-foreground: var(--color-on-accent);
  --color-muted: var(--color-surface-muted);
  --color-muted-foreground: var(--color-text-muted);
  --color-destructive: var(--color-danger);
  --color-input: var(--color-border-control);
  --color-ring: var(--color-accent);
  --radius-lg: var(--radius-control);
  --radius-xl: var(--radius-card);
}
```
Источник: проверенный эксперимент в trial (сборка и поиск в собранном CSS), [VERIFIED: trial build 2026-11-14]. Таблица в `DESIGN.md` (HW4-1) повторяет пары `shadcn → токен DESIGN`; плюс раздел «История изменений» и исключение «Анимации разрешены только в `/prototype/` и `/v2/`; на `/` анимаций нет; `prefers-reduced-motion` учитывается» вместо «Анимаций нет».

### `vite.config.ts` (фрагмент)
```ts
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  appType: 'mpa', // /v2 без слэша — 404, а не страница «/»
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src/client-v2') } },
  server: { port: 5173, strictPort: true, proxy: { '/api': 'http://localhost:3000' } },
  build: {
    outDir: 'dist/client',
    rolldownOptions: {
      input: {
        main: 'index.html',
        v2: 'v2/index.html',
        prototype: 'prototype/index.html',
      },
    },
  },
  test: { include: ['tests/unit/**/*.test.ts'] },
});
```
`tsconfig.json`: `"paths": { "@/*": ["./src/client-v2/*"] }` (без `baseUrl` — допустимо в TypeScript 6). [VERIFIED: trial: tsc, eslint, Vitest-импорт `@/lib/utils` прошли] Правка `appType` применима и к e2e: Playwright `webServer` поднимает `npm run dev`, значит `mpa` уже действует.

### `StatusMessage` — подтверждения без `role="alert"`
```tsx
// Источник: проверено в trial. Alert из shadcn: <div data-slot="alert" role="alert" ... {...props}/> —
// props идут ПОСЛЕ role, поэтому role="status" переопределяет.
import { Alert } from '@/components/ui/alert';
import { motion } from 'motion/react';

export function StatusMessage({ id, children }: { id: number; children: React.ReactNode }) {
  return (
    <motion.div key={id} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <Alert role="status" className="border-accent bg-accent-tint text-text">{children}</Alert>
    </motion.div>
  );
}
// Отказ: <Alert role="alert" className="border-danger-border bg-danger-bg text-danger">…</Alert>
// без AnimatePresence и без exit.
```
Стили классов — ориентир; финальные берутся из `DESIGN.md` («Отказ»/«Подтверждение»).

### Контракт a11y поверх shadcn (проверено `getByRole`/`getByLabel`/`toHaveAccessibleDescription`)
```tsx
<Card role="region" aria-labelledby="loans-title">
  <h2 id="loans-title" className="text-lg">Выдачи</h2>   {/* CardTitle — div, не заголовок */}
  <form aria-label="Выдать книгу">
    <Label htmlFor="book">Книга</Label>
    <NativeSelect id="book" className="w-full" aria-describedby="book-hint">…</NativeSelect>
    <p id="book-hint">Свободно: 2 из 2</p>
  </form>
  <Table>
    <TableCaption className="sr-only">Выдачи</TableCaption>…
  </Table>
</Card>
```
Результаты зонда: `getByRole('region', { name: 'Выдачи', exact: true })`, `getByRole('form', { name })`, `getByLabel('Книга').selectOption({ label })`, `toHaveAccessibleDescription('Свободно: 2 из 2')`, `getByRole('table', { name: 'Выдачи' })` — работают; `getByLabel` в e2e ограничен формой и совпадает и с `aria-label`. [VERIFIED: trial + Playwright] Подвал: `API: ok` отдельным элементом, `h1` «Библиотека».

### Адаптер демо-данных
```ts
// src/client-v2/demo/demo-api.ts — единственный файл, которому разрешён импорт из src/domain.
import type { api } from '@/../client/api'; // тип формы; путь уточнить при реализации
export function createDemoApi(opts: { now?: () => Date; newId?: () => string; failLists?: boolean } = {}): typeof api {
  const now = opts.now ?? (() => new Date());
  // состояние в замыкании: books/readers/loans строятся от now() (просрочка = issuedAt now − 20 дней)
  // checkoutBook/returnBook/availableCopies/isOverdue из domain принимают now: Date — передаём now()
  throw new Error('каркас: реализует план');
}
```
Состояния через хеш (как в макете): `#work #waiting #refusal #issued #saved #returned #first #failed` — `#first` пустые данные, `#failed` списки отклоняются, `#saved` обновление после действия падает, `#waiting` держит промис (`createGate` из `fake-api.ts` плана 06-01); остальные состояния — настоящие действия. [ASSUMED: форма; идея из docs/mockups/main-screen.html и 06-02]

### Серверная сборка для контейнера (рекомендация B)
```jsonc
// tsconfig.server.json (корень репозитория)
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "noEmit": false, "outDir": "dist/api", "rootDir": "src", "declaration": false },
  "include": ["src/server", "src/domain"]
}
```
Запуск: `node dist/api/server/index.js` печатает `API: http://localhost:<PORT>` (корневой `package.json` имеет `"type": "module"`). [VERIFIED: probe в этой сессии с `tsc --ignoreConfig ...`; проверка `-p` с корневым конфигом — на планировщике, TS2688 был из-за расположения вне корня] `rootDir: src` + `dist/api/server/index.js` — путь взят из результата пробы `dist/server-probe/server/index.js`.

### nginx (набросок, не запускался)
```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  absolute_redirect off;                 # /v2 → /v2/ без внешнего хоста
  client_max_body_size 1m;
  location /api/ { proxy_pass http://api:3000; proxy_set_header Host $host; }
  location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; try_files $uri =404; }
  location / { add_header Cache-Control "no-cache"; try_files $uri $uri/ =404; }
  add_header X-Content-Type-Options nosniff always;
}
```
[ASSUMED: синтаксис nginx по знанию, не запускался; `docker info` показал пустой Server — демон не работает.] Если `proxy_pass http://api:3000` без URI в конце, путь `/api/...` передаётся как есть — как ждёт Express (`/api/health`).

### Dockerfile + compose (набросок, не запускался)
```dockerfile
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npx tsc -p tsconfig.server.json

FROM node:24-alpine AS api
WORKDIR /app
ENV NODE_ENV=production PORT=3000 LIBRARY_DATA_FILE=/app/data/library.json
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist/api ./dist/api
COPY data/seed.json /app/seed/seed.json
RUN mkdir -p /app/data && chown node:node /app/data
USER node
CMD ["sh","-c","[ -f \"$LIBRARY_DATA_FILE\" ] || cp /app/seed/seed.json \"$LIBRARY_DATA_FILE\"; exec node dist/api/server/index.js"]

FROM nginx:alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/client /usr/share/nginx/html
```
```yaml
services:
  api:
    build: { context: ., target: api }
    volumes: [ "library-data:/app/data" ]
    healthcheck: { test: ["CMD","wget","-qO-","http://localhost:3000/api/health"], interval: 10s, retries: 5 }
  web:
    build: { context: ., target: web }
    ports: [ "8080:80" ]
    depends_on: { api: { condition: service_healthy } }
volumes:
  library-data:
```
`express`, `zod` в `dependencies` (проверено в `package.json`), поэтому `npm ci --omit=dev` достаточно; `engines.node` в проекте `>=22`, образ Node 24 допустим. Пакеты фронта (tailwind, shadcn…) не нужны на рантайме — они только в build-стадии. [VERIFIED: package.json] Остальное — [ASSUMED] до запуска у автора. Добавить `.dockerignore`: `node_modules`, `dist`, `.git`, `data/*.json` кроме `seed.json`, `test-results`, `.local`, `.claude`, `.planning`.

### Verification commands (Windows, Git Bash)
```bash
export PATH="/c/nvm4w/nodejs:$PATH"
npm run typecheck && npm run lint && npm run format:check
npx vitest run --reporter=json --outputFile=test-results/vitest-unit.json
node -e "const r=JSON.parse(require('fs').readFileSync('test-results/vitest-unit.json','utf8'));const known='format-and-lint hook script formats edited file in place with exit code 0';const bad=r.testResults.flatMap(f=>f.assertionResults.filter(a=>a.status==='failed').map(a=>a.fullName));const broken=r.testResults.filter(f=>f.status==='failed'&&!f.assertionResults.some(a=>a.status==='failed')).map(f=>f.name);console.log('total',r.numTotalTests,'failed',r.numFailedTests);const other=bad.filter(n=>n!==known);if(other.length||broken.length){console.error('НОВЫЕ ПАДЕНИЯ:',other,broken);process.exit(1)}console.log('единственное красное — известный тест hook (D-16)')"
```
Результат базовой линии (до фазы): 558 тестов, 557 прошло, 1 красный — `format-and-lint hook script formats edited file in place with exit code 0`. Проверка падает на любом другом красном тесте или на файле с ошибкой импорта (нет упавшего assertion). Тесты не пропускаются и не правятся. [VERIFIED: запуск 2026-11-14] Относительный путь отчёта (`test-results/`, в `.gitignore`) обходит конвертацию путей MSYS. E2E на Windows: `LIBRARY_DATA_FILE=<временный файл> npm run test:e2e` (2 теста прошли; пересчёт: Playwright запускает 2 воркера, спеки делят dev-сервер и файл данных). Переменных прокси в этой среде нет, `env -u …` не нужен.

## Motion 14 и Playwright (сводка проверок)

| Что | Результат | Тег |
|-----|-----------|-----|
| Импорт | `motion/react`; `motion@14.14.0` зависит от `framer-motion 14.14.0`; peers (react, react-dom, remix) опциональны | VERIFIED: `npm view` |
| `MotionConfig reducedMotion="user"` | отключает transform/layout; opacity и backgroundColor остаются (по документации); эмуляция Playwright `reducedMotion:'reduce'` дала `transform: none` при идущей opacity | VERIFIED: trial; CITED: motion.dev/docs/react-motion-config |
| `AnimatePresence` + exit у alert | 2 alert → `strict mode violation` за ~7–9 мс | VERIFIED: trial |
| Клик по `layout`-строке (переход 0,5 с) | ждёт ~899 мс стабильности | VERIFIED: trial |
| Размер v2-чанка (кроме общего React 220 КБ) | базовый shadcn Button/Alert 33,65 КБ (gzip 13,57); полный `motion`+`AnimatePresence`+`layout` 143,95 КБ (48,61); `LazyMotion`+`m`+`domAnimation` 87,27 КБ (31,31); `domMax` 139,39 КБ (46,84) | VERIFIED: trial build |
| Документация о размере | `motion` ≈ 43 КБ; `m` 5 КБ, `domAnimation` +24 КБ; `layout` требует `domMax` | CITED: motion.dev/docs/react-reduce-bundle-size |

Рекомендация: `LazyMotion features={domAnimation} strict` + компонент `m.*`, без `layout`; длительности 150–300 мс; ровно три места анимации: вход сообщения, вход строки новой выдачи, смена содержимого пустого состояния.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` + `theme.extend` | CSS-first `@theme` в самом CSS | Tailwind 4 | Токены лежат в `styles.css` |
| `build.rollupOptions` | `build.rolldownOptions` (первое — устаревший алиас) | Vite 8 | `[VERIFIED: vite d.ts]` |
| `framer-motion` | пакет `motion`, импорт `motion/react` | Motion 11+ | v14.14.0 |
| shadcn: `cn` из `lib/utils.ts` своей реализации | `export { cn } from "cn"` | shadcn 4.x | Нужен пакет `cn` |
| shadcn с Geist по умолчанию | убирается (D-08) | — | Шрифт из DESIGN.md |

**Deprecated/outdated:**
- `build.rollupOptions` — алиас, использовать `rolldownOptions`.
- Разделы «Анимаций нет» в `DESIGN.md` — заменить исключением для `/prototype/` и `/v2/`.

## Hosting facts (D-15: решает автор; здесь только факты)

**Vercel (прототип — статика).**
- Hobby бесплатен; в таблице планов: проектов 200, деплоев в сутки 100, командная работа — нет, доменов на проект 50; в таблице нет упоминания об ограничении приватных репозиториев или коммерческого использования. [CITED: vercel.com/docs/plans/hobby, last_updated 2026-11-12]
- Vite распознаётся автоматически, выходная папка `dist` по умолчанию; у нас `dist/client` → в настройках проекта `Output Directory = dist/client`, `Build Command = npm run build`. [ASSUMED: поведение пресета; значение `dist/client` из `vite.config.ts` — VERIFIED]
- Вся сборка включает `/` и `/v2/`, которые на Vercel ходят в `/api` (его там нет) → ссылки в подвале прототипа на `/` и `/v2/` ведут на сломанные страницы. Варианты: подвал прототипа на Vercel ссылается на полный URL MVP; либо внешний `rewrites` `/api/:path*` на хост MVP. [ASSUMED]
- Для `/prototype/` корректнее `cleanUrls`/`trailingSlash`: проверить, что `/prototype` без слэша не 404. [ASSUMED]
- Приватные репозитории и Hobby: в сообщении сообщества встречается отказ «Hobby Plan does not support collaboration for private repositories» для деплоя из CLI одиночным владельцем; причина в треде не выяснена. [CITED: community.vercel.com (результат поиска, не официальная документация) — LOW]. Проверить на своём аккаунте до того, как закладывать Vercel в план; запасной путь: публичный репозиторий либо сборка в GitHub Actions и деплой артефактов.

**TimeWeb Cloud.**
- Раздел «Приложения» (Apps/App Platform): деплой из GitHub/GitLab/Bitbucket, выбор фреймворка и сервера, автодеплой по изменениям, откат запуском деплоя с прежним коммитом, бесплатный технический домен с SSL Let's Encrypt. [CITED: timeweb.cloud/docs/apps]
- Страница документации не упоминает ни Docker Compose, ни постоянные тома. Упоминание Docker/Compose для приложений встречается в блоге на Habr (результат поиска). Тарифы раздела в найденных источниках не обнаружены. [LOW — не подтверждено; проверить на timeweb.cloud]
- Надёжный путь для MVP с томом и nginx: обычный облачный сервер (VPS) + Docker + `docker compose up`, HTTPS — отдельным шагом (домен + certbot или Caddy перед nginx). Стоимость и конкретные тарифы — смотреть на timeweb.cloud. [ASSUMED]

Рекомендация без решения за автора: Q2 в Open Questions. Для чек-листа D-13 нужна публичная ссылка по HTTPS (без неё «окно инкогнито» и «консоль без ошибок» не показывают реальную картину; смешанное содержимое HTTP/HTTPS ломает загрузку шрифтов).

## Testing strategy для второго фронта

- **Юнит (Vitest, node-окружение, `tests/unit/**/*.test.ts`):** `loan-view.ts` (`orderLoans`, `activeLoanCount`), логика `StatusMessage`-выбора, адаптер демо-данных с инъекцией `now`/`newId`, тест токенов (`css-tokens.test.ts`: нет hex/rgb/arbitrary вне `@theme`), тест слоёв (импорт из `src/domain` только в `src/client-v2/demo/**`), тест `data/seed.json` (формат `{version, books, readers, loans}` проходит схему хранилища). DOM-тестов нет (окружение node) — компонентное поведение закрывает e2e.
- **E2E (Playwright, `tests/e2e/v2-*.spec.ts`, на `/v2/`):** сценарии FR-1..FR-6 по образцу плана 06-04; GET-списков стабить через `stubLists`/`createGate` из `fake-api.ts` (спеки делят dev-сервер и файл данных); один `getByRole('alert')` для отказа; `toHaveTitle`; NFR-1: `scrollWidth <= innerWidth` при 360, 390 и 1440 px; фокус клавиатурой. Старые `loans.spec.ts` и `smoke.spec.ts` не правятся и гоняются как регрессия `/`.
- **Прототип:** e2e `tests/e2e/prototype.spec.ts`: открывается без API (запросы к `/api` перехватить и упасть, если были), восемь хеш-состояний, основной сценарий.
- **Docker:** отдельный `playwright.docker.config.ts` без `webServer`, `baseURL http://localhost:8080`, только `v2-*.spec.ts` (данные на томе свои — GET не стабить); контрольная точка у автора: `docker compose up --build`, затем `npx playwright test -c playwright.docker.config.ts`. [ASSUMED: форма]
- **Приёмка перед показом (D-13):** чек-лист, часть автоматизируема (`toHaveTitle`, `scrollWidth` при 375, `page.on('console'/'response')` на 404 и `console.error`), инкогнито — ручной шаг.
- Формальная секция Validation Architecture пропущена: `workflow.nyquist_validation` в `.planning/config.json` равен `false`.

## Runtime State Inventory

Не применимо: фаза не переименовывает и не мигрирует существующие сущности (новые каталоги и точки входа добавляются рядом; формат `data/library.json` не меняется).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | всё | ✓ (PATH `/c/nvm4w/nodejs`) | 24.22.1 | — |
| npm | установка, скрипты | ✓ | 11.19.1 | — |
| Docker CLI | HW4-4, D-14 | ✓ клиент | 29.7.2 | — |
| Docker daemon | `docker compose up`, проверка nginx | ✗ (`docker info`: пустой Server) | — | Запуск у автора; план содержит `checkpoint:human-verify` |
| nginx (вне Docker) | проверка конфигурации | не проверялся | — | Проверка только в контейнере (`nginx -t`) |
| Playwright Chromium | e2e | ✓ (2 существующих теста прошли на Windows) | 1.64 | — |
| Интернет / registry | `npm install` | ✓ (WebFetch/WebSearch работали) | — | — |
| Прокси-переменные | — | не заданы | — | `env -u …` не нужен |

**Missing dependencies with no fallback:** запущенный Docker-демон для проверки контейнера (ставится автором); без него критерий 5 ROADMAP не закрыть.
**Missing dependencies with fallback:** проверка nginx — `nginx -t` внутри контейнера у автора.

## Security Domain

`security_enforcement` включён (по умолчанию), ASVS уровня 1.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | нет (по условиям проекта нет учётных записей) | — |
| V3 Session Management | нет | — |
| V4 Access Control | да (риск) | Публичный экземпляр MVP с записью без аутентификации: любой посетитель меняет данные. Для учебного демо принять осознанно и записать в README; закрыть можно только по решению автора (basic auth в nginx — отдельная задача) |
| V5 Input Validation | да | zod на границе `server` (уже есть); `client_max_body_size 1m` в nginx |
| V6 Cryptography | нет (HTTPS на стороне хостинга/прокси) | Сертификаты провайдера или certbot/Caddy; не писать своё |
| V14 Configuration | да | Не публиковать порт Node наружу; `USER node` в контейнере; заголовки `X-Content-Type-Options`; `.dockerignore` исключает `.env*`, `.git`, `.claude`; секретов в образе нет |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Порча демо-данных анонимными запросами | Tampering | Сид при пустом томе (сброс = удалить том); осознанное принятие риска в README |
| Раскрытие внутреннего контейнера | Information Disclosure | Только nginx публикует порт; `api` без `ports` |
| Секреты в образе через `COPY . .` | Information Disclosure | `.dockerignore`; `.env*` не читаются и не копируются |
| Подмена зависимостей (свежие версии, SUS по возрасту) | Tampering | Точные версии из lockfile, `npm ci`, человеческая проверка перед установкой |
| XSS через названия книг | Tampering | React экранирует текст; не использовать `dangerouslySetInnerHTML` |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Синтаксис nginx-конфига и `Dockerfile`/compose из набросков работает без правок (демон Docker не запускался) | Code Examples | Контейнер не поднимется; правится на контрольной точке у автора |
| A2 | Vercel: выход `dist/client` настраивается в проекте; `/prototype` без слэша требует `cleanUrls`/`trailingSlash` | Hosting facts | Прототип 404 на публичной ссылке |
| A3 | Приватные репозитории на Hobby могут блокироваться (одна тема сообщества, не официально) | Hosting facts | Нельзя деплоить из приватного репозитория через интеграцию |
| A4 | TimeWeb Apps поддерживает Docker Compose и тома; тарифы | Hosting facts | MVP придётся на VPS |
| A5 | Инлайн `sh -c` в `CMD` вместо скрипта избегает CRLF-проблемы | Pitfall 9 | Нужен `.gitattributes` |
| A6 | Форма теста токенов и адаптера демо-данных; `playwright.docker.config.ts` | Testing strategy | Замена на аналог при плане |
| A7 | Сид-файл без выдач (во избежание «протухших» дат) | Pitfall 11 | Демо MVP на пустой выдаче выглядит бедно |
| A8 | `domain` можно импортировать из `demo/` (форма адаптера) | Demo adapter | Нарушение трактовки слоёв AGENTS.md |

## Open Questions

1. **Q1. Можно ли импортировать чистые функции `src/domain` в адаптер прототипа?**
   - Что известно: AGENTS.md запрещает `domain` импортировать наружу, но не запрещает клиенту импортировать `domain`; `loans.ts` импортирует только типы; план 06-02 избегал связи ради презентационного слоя.
   - Что неясно: согласие автора.
   - Рекомендация: разрешить импорт только в `src/client-v2/demo/` (прототип честнее — правила те же), закрепить тестом слоёв; запасной вариант — заранее заданные исходы без импорта домена.
2. **Q2. Хостинг (D-15):** Vercel (приватный репозиторий?) для прототипа и VPS TimeWeb с Docker для MVP; нужно проверить на сайтах провайдеров тарифы, поддержку приватных репозиториев и (для PaaS) тома. Рекомендация: до плана спросить автора, какой аккаунт/репозиторий (публичный или нет) и есть ли домен; HTTPS обязателен для показа.
3. **Q3. Согласие на установку пакетов** (см. Package Legitimacy Audit) — блокирует первую волну исполнения.
4. **Q4. Состав `data/seed.json`:** только книги и читатели без выдач (рекомендация) или с выдачами (протухнут по датам).
5. **Q5. `docker compose` сквозная проверка** возможна только у автора (демон не запущен в среде исследования) — оформить как контрольную точку.
6. **Q6. Подвал и ссылки между вариантами на разных хостах:** `/prototype/` на Vercel не может вести на `/v2/` относительной ссылкой; нужен полный URL MVP — станет известен после Q2.

## Sources

### Primary (HIGH confidence)
- Проверка в копии проекта вне репозитория (Vite 8.3.4, TS 6.0.3, React 19.3.1, Tailwind 4.3.5, shadcn 4.23.0, Motion 14.14.0): сборка токенов, мультистраничность dev/build, Motion + Playwright, a11y-зонд, Vitest alias, сборка сервера.
- Репозиторий: `AGENTS.md`, `CLAUDE.md`, `package.json`, `vite.config.ts`, `07-CONTEXT.md`, `DESIGN.md`, `docs/handoff/prd.md` (FR-1..FR-6, NFR-1..NFR-3), планы 06-01..06-04, `src/client/api.ts`, `src/server`, `src/domain`.
- `node_modules/vite/dist/node/index.d.ts` (trial) — `rolldownOptions`.
- `gsd-tools query package-legitimacy check` — вердикты.

### Secondary (MEDIUM confidence)
- https://vercel.com/docs/plans/hobby (last_updated 2026-11-12) — лимиты Hobby.
- https://timeweb.cloud/docs/apps — GitHub/GitLab/Bitbucket, автодеплой, технический домен с Let's Encrypt.
- motion.dev docs (react-motion-config, reduce bundle size) — по материалам проверки в trial.

### Tertiary (LOW confidence)
- Поиск по сообществу Vercel (приватные репозитории на Hobby), Habr (Docker/Compose в TimeWeb Apps) — не подтверждено официальной документацией.
- Все утверждения про Docker и nginx — не запускались в этой сессии.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — версии и совместимость проверены пробной установкой и `npm view`; SUS-вердикты только по возрасту версий.
- Architecture: HIGH для клиента, Vite, Motion, a11y и сборки сервера (проверено); MEDIUM для Docker/nginx (не запускалось).
- Pitfalls: HIGH для найденных в trial (1, 3, 4, 5, 6, 7, 8, 10); MEDIUM для 9 и 11.
- Hosting: LOW — тарифы и ограничения не подтверждены.

**Research date:** 2026-11-14
**Valid until:** 2026-11-21 (Tailwind, shadcn, Motion, lucide-react выпускают версии ежедневно; перепроверить точные версии перед установкой)
