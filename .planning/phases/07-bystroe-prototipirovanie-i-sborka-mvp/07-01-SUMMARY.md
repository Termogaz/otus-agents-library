---
phase: 07-bystroe-prototipirovanie-i-sborka-mvp
plan: 01
subsystem: ui
tags: [tailwind, vite, mpa, design-tokens, playwright, vitest]

requires:
  - phase: 06-produktovaya-analitika-i-vizualnaya-kontseptsiya
    provides: DESIGN.md с токенами цвета, типографики, отступов и размеров
provides:
  - Согласие автора на пакеты фазы 7 (ответ записан ниже, на него опирается 07-10)
  - Три страницы Vite из одного проекта - /, /v2/, /prototype/ (appType mpa, без библиотеки маршрутизации)
  - src/client-v2/styles.css - Tailwind 4 с отключённой палитрой и токенами DESIGN.md в @theme
  - Тест css-tokens - цвета и отступы src/client-v2 только из токенов DESIGN.md
  - e2e оболочки /v2/ и /prototype/
affects: [07-10, 07-02, 07-04, 07-07]

actuals:
  tokens: 4650
  tasks: 2
  commits: 1

tech-stack:
  added: [tailwindcss@4.3.5, "@tailwindcss/vite@4.3.5"]
  patterns:
    - "Токены DESIGN.md в @theme, палитра Tailwind сброшена через --color-*: initial"
    - "Три HTML-точки входа в build.rolldownOptions.input, appType mpa"
    - "Алиас @ на src/client-v2 (vite resolve.alias + tsconfig paths)"

key-files:
  created:
    - v2/index.html
    - prototype/index.html
    - src/client-v2/styles.css
    - src/client-v2/vite-env.d.ts
    - src/client-v2/v2/main.tsx
    - src/client-v2/prototype/main.tsx
    - tests/unit/css-tokens.test.ts
    - tests/e2e/v2-shell.spec.ts
  modified:
    - package.json
    - package-lock.json
    - vite.config.ts
    - tsconfig.json
    - playwright.config.ts

key-decisions:
  - "D-05, T-07-SC: автор согласовал весь список пакетов; этот план поставил только tailwindcss и @tailwindcss/vite 4.3.5 с точной версией"
  - "D-02: appType mpa, иначе dev-сервер отдаёт корневую страницу на любой путь; ссылки на варианты только со слэшем"
  - "D-04: правило NFR-3 для client-v2 закреплено тестом css-tokens (цвета, произвольные значения, шаги отступов)"
  - "playwright без сети не запрашивает Google Fonts (host-resolver-rules), переменная E2E_REAL_FONT отключает правило"

patterns-established:
  - "Тест токенов: классы цвета проверяются по именам из @theme, служебные слова (размеры, стороны, стили границы) перечислены в тесте явно"

requirements-completed: [HW4-2, HW4-3]

coverage:
  - id: D1
    description: "Автор согласовал пакеты фазы до первой установки (package gate T-07-SC)"
    requirement: HW4-3
    verification: []
    human_judgment: true
    rationale: "Согласие даёт человек; ответ автора записан в разделе «Согласие автора»"
  - id: D2
    description: "Страницы /v2/ и /prototype/ открываются со своими заголовками на токенах DESIGN.md, / не изменился"
    requirement: HW4-2
    verification:
      - kind: e2e
        ref: "tests/e2e/v2-shell.spec.ts#opens v2 page with its own title and design tokens"
        status: pass
      - kind: e2e
        ref: "tests/e2e/v2-shell.spec.ts#opens prototype page with its own title"
        status: pass
      - kind: e2e
        ref: "tests/e2e/smoke.spec.ts, tests/e2e/loans.spec.ts без изменений"
        status: pass
    human_judgment: false
  - id: D3
    description: "Цвета и отступы src/client-v2 только из токенов DESIGN.md"
    requirement: HW4-3
    verification:
      - kind: unit
        ref: "tests/unit/css-tokens.test.ts"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-11-14
status: complete
plan_head_before: 4c5bd92ab12019eed373c375a6e403e99007859f
plan_head_after: 34de6c463961076ecf67adc5740481bad6d3ae76
commits: 1
---

# Phase 7 Plan 01: Tailwind 4 и токены DESIGN.md на трёх страницах Vite Summary

**Tailwind 4.3.5 подключён ко второму фронту: Vite собирает `/`, `/v2/` и `/prototype/` из одного проекта, `@theme` повторяет токены DESIGN.md с отключённой палитрой Tailwind, а тест `css-tokens` не даёт цветам и отступам выйти за токены.**

## Performance

- **Duration:** 5 min (Task 2; Task 1 решён автором до запуска)
- **Started:** 2026-11-14T12:27:41Z
- **Completed:** 2026-11-14T12:31:30Z
- **Tasks:** 2 (Task 1 - checkpoint, Task 2 - tracer)
- **Files modified:** 13 (8 создано, 5 изменено)

## Согласие автора

Ответ автора на Task 1 (2026-11-14), дословно: «Пакеты согласованы»

Исключений автор не назвал. Согласие охватывает: tailwindcss@4.3.5 и @tailwindcss/vite@4.3.5 (devDependencies, точные версии, ставил этот план); motion@14.14.0 и пакеты `npx shadcn@4.23.0 init` (ставит план 07-10); правку tsconfig.json только в части `"paths": { "@/*": ["./src/client-v2/*"] }`.

Согласие автора: пакеты согласованы

## Accomplishments

- Установлены `tailwindcss` и `@tailwindcss/vite` 4.3.5 без `^`; больше ни один пакет не добавлялся (T-07-01).
- `vite.config.ts`: плагин `tailwindcss()` после `react()`, `appType: 'mpa'`, алиас `@`, три входа в `build.rolldownOptions.input`; блоки `server`, `build.outDir`, `test.include` не тронуты. `tsconfig.json`: добавлен только `paths`.
- `src/client-v2/styles.css`: `--color-*: initial` и все 19 цветов DESIGN.md, `--font-sans`, размеры текста с высотами строк, `--radius-control`, `--radius-card`, `--container-content`; фон body, цвет текста и шрифт из токенов; тёмной темы нет.
- `v2/index.html`, `prototype/index.html` и оболочки `main.tsx` со своими заголовками вкладки, ссылками Google Fonts и пустой иконкой.
- `tests/unit/css-tokens.test.ts` (6 тестов): совпадение 19 цветов с DESIGN.md, сброс палитры, шрифт, размеры и радиусы, цвета и произвольные значения только из токенов, шаги отступов 0, 1, 2, 3, 4, 6, 8, auto. Проверен вручную на пробном файле с `bg-red-500`, `p-5`, `text-[#fff]`, `w-[10px]`: тест краснеет, пробный файл удалён.
- `tests/e2e/v2-shell.spec.ts`: заголовок вкладки, цвет заголовка `rgb(28, 43, 29)`, фон body `rgb(242, 249, 251)`.
- `playwright.config.ts`: без `E2E_REAL_FONT` Chromium не резолвит `fonts.googleapis.com` и `fonts.gstatic.com`.

## Evidence

`npm ls tailwindcss @tailwindcss/vite`:

```text
otus-agents-library@0.1.0
+-- @tailwindcss/vite@4.3.5
| +-- @tailwindcss/node@4.3.5
| | `-- tailwindcss@4.3.5 deduped
| `-- tailwindcss@4.3.5 deduped
`-- tailwindcss@4.3.5
```

Проверки плана: `npm run typecheck`, `npm run lint`, `npm run format:check` зелёные; Vitest 564 теста, 1 красный - известный тест hook `format-and-lint` (D-16), новых падений нет; `npx vite build` создал `dist/client/v2/index.html` и `dist/client/prototype/index.html`; Playwright `v2-shell`, `smoke`, `loans` - 4 из 4; FREEZE дал код 0.

## Task Commits

1. **Task 1: Согласие автора на пакеты и правку tsconfig** - без коммита (checkpoint, файлов не менял)
2. **Task 2: Страница /v2/ с токенами DESIGN.md** - `34de6c4` (feat)

## Deviations from Plan

None - plan executed exactly as written.

Замечания, не меняющие план:
- Установка выдала `npm warn install-scripts` про postinstall у `esbuild@0.28.2`; этот пакет не добавлялся планом (приходит с tsx и vite), в lockfile строк `esbuild` diff не содержит.
- Новые транзитивные зависимости `tailwindcss` (`@tailwindcss/node`, `@tailwindcss/oxide*`, `enhanced-resolve`, `jiti`, `tapable`, `graceful-fs`, `@jridgewell/*`) разрешил npm, lockfile вручную не правился.
- `npm install` сообщил о 10 уязвимостях (9 moderate, 1 high) в дереве зависимостей; `npm audit fix` не запускался, вне области плана.
- Hook `format-and-lint` на Windows отвечал `spawnSync ... ENOENT` после каждой правки (известная проблема); форматирование выполнено `prettier --write` вручную.

## Issues Encountered

None.

## Known Stubs

Оболочки `src/client-v2/v2/main.tsx` и `src/client-v2/prototype/main.tsx` содержат только заголовок (и строку про демо-данные в прототипе); это намеренно, наполняют планы 07-04 и 07-07.

## Threat Flags

None.

## Next Phase Readiness

Готов план 07-10: пакеты согласованы (строка выше), `@theme`, алиас `@` и `paths` на месте; `shadcn init` должен добавить блок `@theme inline` и не трогать `--color-*: initial`.

## Self-Check: PASSED

- Созданные файлы существуют, коммит `34de6c4` в истории ветки `feat/mvp-prototype`, FREEZE код 0.
