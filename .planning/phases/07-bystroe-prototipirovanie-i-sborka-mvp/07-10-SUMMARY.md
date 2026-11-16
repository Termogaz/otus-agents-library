---
phase: 07-bystroe-prototipirovanie-i-sborka-mvp
plan: 10
subsystem: ui
tags: [shadcn, radix-nova, tailwind, design-tokens, motion, vitest]

requires:
  - phase: 07-bystroe-prototipirovanie-i-sborka-mvp
    provides: Tailwind 4 с @theme на токенах DESIGN.md, алиас @, согласие автора на пакеты (07-01)
provides:
  - Семь компонентов shadcn (button, input, label, card, table, alert, native-select) на токенах DESIGN.md
  - Блок @theme inline в styles.css - имена shadcn привязаны к токенам DESIGN.md
  - components.json и cn в src/client-v2/lib/utils.ts
  - motion 14.14.0 с точной версией (используется в 07-06)
  - Три новых теста css-tokens (соответствие имён, отсутствие тёмной темы и лишнего шрифта, отсутствие теней)
  - Разделы DESIGN.md «Соответствие токенам shadcn/ui» и «История изменений»
affects: [07-04, 07-05, 07-06, 07-07]

actuals:
  tokens: 5900
  tasks: 3
  commits: 3

tech-stack:
  added:
    - motion@14.14.0
    - shadcn@4.23.0
    - radix-ui@1.8.1
    - class-variance-authority@0.7.1
    - cn@0.5.2
    - lucide-react@1.73.0
    - tw-animate-css@1.4.0
  patterns:
    - "@theme inline: семантические имена shadcn ссылаются на токены DESIGN.md через var(--color-...)"
    - "Фокус контуром focus-visible:outline-2 без outline-none (в Tailwind 4 outline-none ломает контур)"
    - "Alert задаёт только форму; role переопределяется снаружи"

key-files:
  created:
    - components.json
    - src/client-v2/lib/utils.ts
    - src/client-v2/components/ui/button.tsx
    - src/client-v2/components/ui/input.tsx
    - src/client-v2/components/ui/label.tsx
    - src/client-v2/components/ui/card.tsx
    - src/client-v2/components/ui/table.tsx
    - src/client-v2/components/ui/alert.tsx
    - src/client-v2/components/ui/native-select.tsx
  modified:
    - package.json
    - package-lock.json
    - src/client-v2/styles.css
    - tests/unit/css-tokens.test.ts
    - DESIGN.md

key-decisions:
  - "D-08: имена shadcn сопоставлены токенам в @theme inline; блоков тёмной темы, sidebar и chart нет, Geist удалён после init"
  - "D-11: сгенерированные компоненты переписаны вручную под DESIGN.md вместо CSS-модулей плана 06-03"
  - "D-12: native-select на всю ширину, у table контейнер прокрутки с role=region и tabIndex=0, alert не фиксирует role"
  - "Card.Title оставлен div: роль заголовка задаёт разметка экрана"

patterns-established:
  - "Комментарии в компонентах не должны содержать слов, похожих на классы цвета: тест css-tokens читает исходники построчно"

requirements-completed: [HW4-1, HW4-3]

coverage:
  - id: D1
    description: "Пакеты shadcn init и motion поставлены только по согласию автора, Geist удалён, версии tailwindcss, @tailwindcss/vite и motion точные"
    requirement: HW4-3
    verification:
      - kind: other
        ref: "node-проверка package.json из verify Task 2 (нет пакетов fontsource, tailwindcss и @tailwindcss/vite 4.3.5, motion 14.14.0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Имена shadcn сопоставлены токенам DESIGN.md, тёмной темы и лишнего шрифта нет"
    requirement: HW4-1
    verification:
      - kind: unit
        ref: "tests/unit/css-tokens.test.ts#maps shadcn semantic names to DESIGN.md tokens"
        status: pass
      - kind: unit
        ref: "tests/unit/css-tokens.test.ts#keeps no dark theme, extra stylesheet or extra font"
        status: pass
    human_judgment: false
  - id: D3
    description: "Компоненты берут цвета, шаги отступов и тени только из токенов DESIGN.md"
    requirement: HW4-3
    verification:
      - kind: unit
        ref: "tests/unit/css-tokens.test.ts#uses no shadows"
        status: pass
      - kind: unit
        ref: "tests/unit/css-tokens.test.ts#uses colors only from tokens in client-v2 sources"
        status: pass
    human_judgment: false
  - id: D4
    description: "Заморозка / сохранена: src/client, index.html, loans.spec и smoke.spec не изменены, e2e проходят"
    requirement: HW4-3
    verification:
      - kind: e2e
        ref: "tests/e2e/v2-shell.spec.ts, smoke.spec.ts, loans.spec.ts - 4 из 4"
        status: pass
    human_judgment: false
  - id: D5
    description: "DESIGN.md показывает токен за каждым из 14 имён shadcn"
    requirement: HW4-1
    verification:
      - kind: other
        ref: "node-проверка раздела «Соответствие токенам shadcn/ui» из verify Task 3 (14 имён)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-11-14
status: complete
plan_head_before: 34de6c463961076ecf67adc5740481bad6d3ae76
plan_head_after: dc89e844a4fb1a4d43488c8c5175caa40c9accc0
commits: 3
---

# Phase 7 Plan 10: shadcn/ui и Motion на токенах DESIGN.md Summary

**shadcn/ui (radix-nova) поставлен по согласию автора и привязан к DESIGN.md через `@theme inline`: семь компонентов переписаны без теней и произвольных цветов, motion 14.14.0 стоит с точной версией, DESIGN.md содержит таблицу из 14 соответствий.**

## Performance

- **Duration:** около 25 мин (с учётом сжатия контекста посреди Task 2)
- **Tasks:** 3 (Task 1 - tracer, Task 2 и Task 3 - auto)
- **Files modified:** 14 (9 создано, 5 изменено; `package-lock.json` менял только npm)

## Accomplishments

- `npx shadcn@4.23.0 init -y -b radix -p nova`, затем `add button` и `add input label card table alert native-select`. После каждого запуска CLI проверен `git status --short`: `vite.config.ts`, `tsconfig.json`, `index.html`, `src/client/**` не тронуты (T-07-27). Пакет `@fontsource-variable/geist` удалён после init.
- `src/client-v2/styles.css`: блок `@theme inline` (13 пар: `background`, `foreground`, `card`, `card-foreground`, `primary`, `primary-foreground`, `muted`, `muted-foreground`, `destructive`, `input`, `ring`, `radius-lg`, `radius-xl`), `@custom-variant dark` и `tw-animate-css`; `@theme` из 07-01 с `--color-*: initial` не изменён; база: цвет границы, фон и шрифт body из токенов.
- Компоненты переписаны под DESIGN.md: кнопка с вариантами `default` и `outline`, размеры 40 и 32 px, фокус контуром; поле и список высотой 40 px с границей `border-input`; таблица с контейнером `role="region"`, `tabIndex={0}`, пропом `containerLabel`, `sr-only` в подписи и `whitespace-normal`; карточка без тени; `Alert` только формой, `role` перекрывается снаружи; подпись `text-base font-medium`.
- `tests/unit/css-tokens.test.ts`: три новых теста (см. RED ниже).
- `DESIGN.md`: раздел «Соответствие токенам shadcn/ui» сразу после «Токены» (14 строк) и «История изменений» последним разделом.

## Evidence

RED до правок. После `init` и `add button` красными были 5 тестов css-tokens, включая оба новых (`maps shadcn semantic names to DESIGN.md tokens`, `keeps no dark theme, extra stylesheet or extra font`). После `add input label card table alert native-select` красными оставались 3: цвета вне токенов, шаги отступов вне шкалы и `uses no shadows`. После переписывания компонентов все 9 тестов css-tokens зелёные.

`npm ls` (версии всех новых пакетов):

```text
otus-agents-library@0.1.0
+-- @tailwindcss/vite@4.3.5
+-- class-variance-authority@0.7.1
+-- cn@0.5.2
+-- lucide-react@1.73.0
+-- motion@14.14.0
+-- radix-ui@1.8.1
+-- shadcn@4.23.0
+-- tailwindcss@4.3.5
`-- tw-animate-css@1.4.0
```

Проверки: `npm run typecheck`, `npm run lint`, `npm run format:check` зелёные; Vitest 567 тестов, 1 красный - известный тест hook `format-and-lint` (D-16), новых падений нет; `npx vite build` собрался; Playwright `v2-shell`, `smoke`, `loans` - 4 из 4; FREEZE (`git diff --exit-code main` по замороженным файлам и только добавленные строки в `App.tsx`) дал код 0; `vite.config.ts` и `tsconfig.json` не менялись.

## Task Commits

1. **Task 1: init shadcn и кнопка на токенах** - `418d15f` (feat)
2. **Task 2: остальные компоненты shadcn и Motion** - `8ae95c5` (feat)
3. **Task 3: таблица соответствия токенам shadcn/ui в DESIGN.md** - `dc89e84` (docs)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Тест 07-01 `defines exactly the DESIGN.md color tokens` ломался на `@theme inline`**
- **Found during:** Task 1
- **Issue:** тест собирал цвета из всех блоков `@theme`, а `@theme inline` добавил алиасы shadcn (`--color-primary` и др.); тест краснел на 13 лишних именах.
- **Fix:** добавлена вспомогательная функция `plainThemeBlocks()` (только простые блоки `@theme`, без `inline`); её использует только этот тест. Сам набор токенов и проверки не ослаблены: алиасы проверяет новый тест `maps shadcn semantic names to DESIGN.md tokens`.
- **Files modified:** `tests/unit/css-tokens.test.ts`
- **Commit:** 418d15f

**2. [Rule 1 - Bug] Генерируемая кнопка ломала фокус и границу**
- **Found during:** Task 1
- **Issue:** `outline-none` в базовом классе в Tailwind 4 задаёт `--tw-outline-style: none` и отключает `focus-visible:outline-2`; `border-transparent` в базе конфликтовал с цветом границы варианта `outline`.
- **Fix:** оба класса убраны; фокус только `focus-visible:outline-2 outline-offset-2 outline-ring`; прозрачная граница только у `disabled`.
- **Files modified:** `src/client-v2/components/ui/button.tsx`
- **Commit:** 418d15f

**3. [Rule 1 - Bug] Комментарий в `input.tsx` сработал как класс цвета**
- **Found during:** Task 2 verify
- **Issue:** слово `border-control` в комментарии подхватил тест `uses colors only from tokens`.
- **Fix:** комментарий переписан без имени класса.
- **Files modified:** `src/client-v2/components/ui/input.tsx`
- **Commit:** 8ae95c5

### Прочее

- Hook `format-and-lint` на Windows отвечал `spawnSync ... ENOENT` после каждой правки (известная проблема); форматирование выполнено `prettier --write` вручную.
- Случайная команда python в фоне (`bjjee0c25`) осталась висеть; файлов она не меняла.
- `npm install` предупредил про postinstall у `esbuild@0.28.2` и уязвимости в дереве; пакет не добавлялся этим планом, `npm audit fix` не запускался.
- `package-lock.json` менял только npm; в нём `shadcn` приносит собственную копию `cn@0.2.6` рядом с `cn@0.5.2` проекта (транзитивная зависимость, не новый пакет).

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

- Файлы `components.json`, `src/client-v2/lib/utils.ts`, семь компонентов в `src/client-v2/components/ui/`, `styles.css` и `DESIGN.md` существуют.
- Коммиты `418d15f`, `8ae95c5`, `dc89e84` входят в историю ветки `feat/mvp-prototype`; `git rev-list --count` от `plan_head_before` даёт 3.
