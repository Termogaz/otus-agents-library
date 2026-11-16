# Фаза 7: Быстрое прототипирование и сборка MVP - карта паттернов

**Составлено:** 2026-11-14
**Файлов классифицировано:** 27
**Аналоги найдены:** 21 / 27 (6 без аналога: Dockerfile, nginx.conf, compose, .dockerignore, tsconfig.server.json, data/seed.json)

Все аналоги проверены как отслеживаемые git (`git ls-files`). Пути и номера строк даны по текущему состоянию рабочей копии.

## Классификация файлов

| Новый/изменяемый файл | Роль | Поток данных | Ближайший аналог | Качество |
|---|---|---|---|---|
| `v2/index.html`, `prototype/index.html` | точка входа | статика | `index.html` | точное |
| `src/client-v2/v2/main.tsx` | точка входа React | render | `src/client/main.tsx` | точное |
| `src/client-v2/prototype/main.tsx` | точка входа React | render | `src/client/main.tsx` | точное |
| `src/client-v2/app.tsx` | компонент-корень | request-response | `src/client/App.tsx` | точное (+проп `api`) |
| `src/client-v2/features/LoansSection.tsx` | компонент | CRUD-форма + таблица | `src/client/LoansSection.tsx` | точное |
| `src/client-v2/features/BooksSection.tsx`, `ReadersSection.tsx` | компонент | CRUD | `src/client/BooksSection.tsx`, `ReadersSection.tsx` (не читались, устроены как LoansSection) | по роли |
| `src/client-v2/components/StatusMessage.tsx` | компонент | событие | `<p role="alert">` в `src/client/App.tsx:46` | частичное |
| `src/client-v2/components/VariantFooter.tsx` | компонент | статика | `<p>API: ...</p>` в `src/client/App.tsx:45` | частичное |
| `src/client-v2/loan-view.ts` | утилита | transform | `status()`/`formatDate()` в `src/client/LoansSection.tsx:12-19` | по роли |
| `src/client-v2/demo/demo-api.ts` | адаптер | CRUD в памяти | форма `api` в `src/client/api.ts:62-72` + `src/domain/loans.ts` | по роли |
| `src/client-v2/demo/demo-data.ts` | данные | - | типы `src/client/api.ts:3-22` | по роли |
| `src/client-v2/styles.css`, `components/ui/*`, `lib/utils.ts`, `vite-env.d.ts` | стили / сгенерированный код shadcn | - | аналога нет (у `/` CSS нет) | нет |
| `src/client/App.tsx` (изменение: ссылки в подвал) | компонент | - | сам файл | - |
| `vite.config.ts` (изменение) | конфиг | - | сам файл `vite.config.ts:1-19` | - |
| `tsconfig.json` (изменение: `paths`) | конфиг | - | сам файл | - |
| `tsconfig.server.json` | конфиг | - | `tsconfig.json` (extends) | по роли |
| `tests/unit/demo-api.test.ts` | тест | request-response | `tests/unit/client-api.test.ts` | точное |
| `tests/unit/loan-view.test.ts`, тесты компонентов | тест | transform | `tests/unit/loans.test.ts` (по роли, не читался) | по роли |
| `tests/unit/css-tokens.test.ts` | тест | file-I/O | `tests/unit/lib-skills.test.ts` (сканирование файлов, не читался) | по роли |
| `tests/e2e/v2-*.spec.ts` | e2e | request-response | `tests/e2e/loans.spec.ts` | точное |
| `Dockerfile`, `docker/nginx.conf`, `docker-compose.yml`, `.dockerignore`, `data/seed.json` | инфраструктура | - | нет | нет |

## Назначение паттернов

### `v2/index.html` и `prototype/index.html`
**Аналог:** `index.html` (1-14).
```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Библиотека</title>
    <!-- Пустая иконка: без неё браузер запрашивает /favicon.ico и пишет 404 в консоль -->
    <link rel="icon" href="data:," />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/client/main.tsx"></script>
```
Отличия: `<title>` разный («Библиотека, вариант 2» и «Библиотека, прототип» — формулировку взять из UX-текстов, D-13 проверяет заголовок вкладки); добавить `<link>` Google Fonts IBM Plex Sans (preconnect + stylesheet); `src="/src/client-v2/v2/main.tsx"` и `/src/client-v2/prototype/main.tsx`. Пустую иконку и комментарий сохранить (иначе 404 в консоли, чек-лист D-13). Корневой `index.html` не получает CSS.

### `src/client-v2/{v2,prototype}/main.tsx`
**Аналог:** `src/client/main.tsx` (1-12).
```tsx
const root = document.getElementById('root');
if (!root) throw new Error('#root not found');
createRoot(root).render(<StrictMode><App /></StrictMode>);
```
Отличия: `import '../styles.css'`; `<MotionConfig reducedMotion="user">` вокруг `<App api={api} />`; в v2 `api` из `../../client/api` (единственный импорт из старого клиента, D-02), в prototype `createDemoApi()`.

### `src/client-v2/app.tsx`
**Аналог:** `src/client/App.tsx` (1-59).
Импорты (1-5): `import { useCallback, useEffect, useState } from 'react'; import { errorMessage, type BookView, ... } from '../client/api';` и секции.
Паттерн обновления и отказа (14-40), копировать дословно:
```tsx
const refresh = useCallback(async () => {
  const [b, r, l] = await Promise.all([api.listBooks(), api.listReaders(), api.listLoans()]);
  setBooks(b); setReaders(r); setLoans(l);
}, []);
...
async function run(action: () => Promise<unknown>): Promise<boolean> {
  try { await action(); setError(null); await refresh(); return true; }
  catch (e) { setError(errorMessage(e)); return false; }
}
```
Единственный `role="alert"` (46): `{error && <p role="alert">{error}</p>}`.
Отличия:
- `api` приходит пропсом типа `typeof api` (общие компоненты для `/v2/` и `/prototype/`); `useCallback` зависит от `api`.
- Состояния FR-1 («Загрузка…», пустой список только после успешной загрузки, при ошибке текста о пустом списке нет) - отдельный флаг загрузки.
- FR-5: ошибка обновления после успешного действия даёт «Сохранено, но список не обновился» (в старом `run` `refresh()` внутри `try` превратил бы это в отказ) - разделить `await action()` и `refresh()` в разных try.
- FR-3: флаг `busy`, кнопки `disabled`.
- Подтверждения через `role="status"` (`StatusMessage`), на странице один `role="alert"`.
- Подвал: `API: {apiStatus}` отдельным элементом (как 45) и ссылки `/`, `/v2/`, `/prototype/` со слэшем. В prototype `/api/health` не вызывать (сервера нет): статус от адаптера.
- Заголовок: настоящий `<h1>Библиотека</h1>` (44).

### `src/client-v2/features/LoansSection.tsx`
**Аналог:** `src/client/LoansSection.tsx` (1-94).
Контракт, который должен сохраниться ради e2e (используется `loans.spec.ts`):
```tsx
<form aria-label="Выдать книгу" onSubmit={submit}>
  <label>Книга ... <select ... required><option value="">— выберите —</option>
...
<table><caption>Выдачи</caption>
... <td>{status(loan)}</td> ... <button type="button" onClick=...>Вернуть</button>
```
Props-форма (4-10): `books, readers, loans, onCheckout: (bookId, readerId) => Promise<boolean>, onReturn`. Тексты статусов (12-15): `Возвращена` / `Просрочена` / `На руках`. Комментарий «Выбор не сбрасывается после выдачи» (22) - в v2 по FR-5 формы очищаются после успеха: заменить комментарий и поведение (сброс только при `true`).
Отличия: `Card role="region" aria-labelledby` + настоящий `<h2 id>` (CardTitle - div); `Label htmlFor` вместо обёртки-`label` (доступное имя `getByLabel('Книга')` сохраняется); `NativeSelect className="w-full"` с `aria-describedby` на «Свободно: N из M» (FR-6); `Table` с `TableCaption className="sr-only"`; статус текстом и цветом (токены `danger-*`), порядок строк `orderLoans` (FR-4); `formatDate` перенести как есть (17-19). Тексты и комментарии - на русском.

### `StatusMessage.tsx`
**Аналог:** `<p role="alert">` (`src/client/App.tsx:46`); пример кода - RESEARCH, раздел «StatusMessage». Следовать: `Alert role="status"` для подтверждений, `role="alert"` только для отказа; вход через `motion.div` с `key={id}`, без `AnimatePresence` и `exit` (Pitfall 3). Текст отказа брать из `errorMessage`.

### `loan-view.ts`
**Аналог:** `status` и `formatDate` (`src/client/LoansSection.tsx:12-19`) - вынести их и добавить `orderLoans`, `activeLoanCount`. Правило: без импорта `src/domain` (domain разрешён импортировать только `demo/`).

### `demo/demo-api.ts`
**Аналог формы:** `src/client/api.ts:62-72` (`api` - все семь методов, возврат `Promise`). Ошибки - тот же `ApiError(code)` из `api.ts:25-29` с кодами `NO_FREE_COPIES`, `LOAN_LIMIT_REACHED`, `LOAN_ALREADY_RETURNED` (таблица сообщений 31-40), чтобы `errorMessage` работал без изменений.
Правила домена: функции `checkoutBook`, `returnBook`, `availableCopies`, `isOverdue` (`src/domain/loans.ts:17, 55, 50, 63`) принимают `now: Date`; даты передавать параметром (AGENTS.md), `now` внедряется через опцию фабрики `createDemoApi({ now })`. Типы результата домена и проекцию в `BookView/LoanView` (поля `available`, `overdue`, ISO-строки) смотреть в `src/server/app.ts` (не читался; исполнитель обязан прочитать его, чтобы повторить форму ответов). Сигнатуру `createDemoApi(): typeof api` - см. RESEARCH «Адаптер демо-данных».

### `tests/unit/demo-api.test.ts` и юнит-тесты клиента
**Аналог:** `tests/unit/client-api.test.ts` (1-60).
```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, errorMessage } from '../../src/client/api.js';
```
Паттерны: хелпер `messageOf(promise)` (13-20) для проверки текста отказа; `describe('...')` + `it('shows ...')` на английском с описанием поведения (27, 33); `afterEach(vi.unstubAllGlobals)`. Импорт с `.js`-суффиксом из `tests/unit` -> `../../src/client-v2/...`; через `@/` тоже допустимо (alias проверен RESEARCH). Vitest подхватывает только `tests/unit/**/*.test.ts` (`vite.config.ts:17`) - тесты компонентов в `.test.tsx` не запустятся: либо тестировать чистые функции, либо менять `include` (согласовать).

### `tests/unit/css-tokens.test.ts`
Аналог по роли - тест, читающий файлы проекта (`tests/unit/lib-skills.test.ts`, исполнитель прочитает его перед написанием). Переписывается из плана `06-04`; проверка размера CSS убирается. Сканирует `src/client-v2/**` на `#hex`, `rgb(`, `hsl(`, `oklch(`, `\[#`, `-\[\d+px\]`; hex разрешён только внутри `@theme` в `styles.css`.

### `tests/e2e/v2-*.spec.ts`
**Аналог:** `tests/e2e/loans.spec.ts` (1-45). Следовать буквально:
```ts
import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
const tag = randomUUID().slice(0, 8);   // уникальные названия: общий файл данных dev-сервера
await page.goto('/v2/');                // со слэшем
const loanForm = page.getByRole('form', { name: 'Выдать книгу' });
await loanForm.getByLabel('Книга').selectOption({ label: title });
await expect(page.getByRole('alert')).toHaveText('Нет свободных экземпляров');
const loanRow = page.getByRole('table', { name: 'Выдачи' }).getByRole('row', { name: title });
```
Правила `.claude/rules/e2e.md`: только роли и тексты, web-first ожидания, без `waitForTimeout`, без CSS/XPath, без `.skip/.only`, имя теста на английском («issues a book ...»). Отличия: первая проверка `await expect(page).toHaveTitle(...)` (Pitfall 1); перед скриншотами `toHaveCSS('opacity', '1')` (Pitfall 4); `getByRole('region', { name: 'Выдачи', exact: true })`; подтверждение через `getByRole('status')`. Состояния прототипа проверять через хеш-URL `/prototype/#refusal` и т.п. `playwright.config.ts` (`baseURL`, `webServer: npm run dev`) не менять: `appType: 'mpa'` подхватится.

### `vite.config.ts` (изменение)
**Аналог:** текущий файл (1-19): `plugins: [react()]`, `server.proxy['/api']`, `build.outDir: 'dist/client'`, `test.include`. Добавить: `tailwindcss()` в `plugins`, `appType: 'mpa'`, `resolve.alias['@']`, `build.rolldownOptions.input` с тремя входами; остальное не трогать. Точный фрагмент - RESEARCH «`vite.config.ts` (фрагмент)». Импорт `path` - `node:path` (стиль `node:`-префикса как в `loans.spec.ts:1`).

### `tsconfig.json` (изменение)
Единственная правка - `"paths": { "@/*": ["./src/client-v2/*"] }` в `compilerOptions` (строки 2-18). `include` уже покрывает `src`, `tests`, `*.ts`. Строгость не ослаблять (AGENTS.md); упомянуть в согласовании.

### `tsconfig.server.json`
**Аналог по роли:** `tsconfig.json`. `extends: "./tsconfig.json"`, `noEmit: false`, `outDir: dist/api`, `rootDir: src`, `include: ["src/server","src/domain"]`; лежит в корне (Pitfall 8). Точка запуска - `src/server/index.ts:4-5`: `PORT`, `LIBRARY_DATA_FILE` (по умолчанию `data/library.json`) - хватает для контейнера. Примечание: серверные импорты уже с `.js` (`./app.js`), так что `tsc`-сборка работает; нативный `node *.ts` падает на импортах без расширений в `domain` (проверить при реализации).

### `src/client/App.tsx` (изменение, D-01/D-03)
Только добавить в `<main>` ссылки на `/v2/` и `/prototype/` (после `<p>API: ...</p>`, 45). Не менять `role="alert"`, заголовки, подписи: `loans.spec.ts` и `smoke.spec.ts` на них опираются. Стили не добавлять (NFR-3 для `/`). `smoke.spec.ts` не читался: перед правкой проверить, нет ли в нём `getByRole('link')` и точного текста страницы.

## Общие паттерны

- **Обработка отказов API:** `ApiError(code)` + `errorMessage` из `src/client/api.ts:25-45` - единственный источник текстов отказа в обоих вариантах; не копировать таблицу сообщений.
- **Один alert:** `role="alert"` только для отказа и один на страницу; подтверждения - `role="status"`.
- **Подписи a11y:** формы `aria-label="Выдать книгу" / "Добавить книгу" / "Добавить читателя"`, таблицы `caption` «Книги»/«Выдачи», кнопки «Выдать», «Вернуть», «Добавить» - как в `loans.spec.ts:12-41`.
- **Язык:** тексты UI и комментарии на русском, имена тестов на английском, файлы `kebab-case.ts`, компоненты `PascalCase.tsx` (AGENTS.md; примеры комментариев - `api.ts:1, 24, 54`, `LoansSection.tsx:22`).
- **Слои:** `src/client-v2` импортирует из старого клиента только `src/client/api.ts`; `src/domain` - только `demo/`.
- **Дата:** `now: Date` параметром, не `new Date()` внутри правил (`loans.ts` сигнатуры).
- **TDD/проверки:** после `shadcn add` - `npm run format`; перед завершением `npm run check` (на Windows известный красный тест hook, D-16) и `npm run test:e2e`.
- **Установка пакетов:** только после согласия автора (checkpoint:human-verify, см. RESEARCH «Package Legitimacy Audit»).

## Аналог не найден (использовать RESEARCH)

| Файл | Роль | Поток | Основание |
|---|---|---|---|
| `Dockerfile` | инфраструктура | build | RESEARCH «Dockerfile + compose» (набросок, не запускался) |
| `docker/nginx.conf` | инфраструктура | proxy/static | RESEARCH «nginx»; без SPA-fallback; `absolute_redirect off` |
| `docker-compose.yml` | инфраструктура | оркестрация | RESEARCH «Dockerfile + compose», именованный том `library-data` |
| `.dockerignore` | инфраструктура | - | нет аналога; исключить `node_modules`, `dist`, `.env*`, `.planning`, `.claude` |
| `data/seed.json` | данные | seed | формат - как `data/library.json` через `src/server/json-file-repository.ts`; только книги и читатели, без выдач (Pitfall 11); исполнитель читает репозиторий для точной формы |
| `src/client-v2/styles.css`, `components/ui/*`, `lib/utils.ts`, `vite-env.d.ts` | стили/UI | - | генерирует `shadcn init/add`; токены - RESEARCH «`styles.css`» и «Pattern 1» |

## Метаданные
**Область поиска:** `src/client`, `src/server/index.ts`, `src/domain/loans.ts`, `tests/unit`, `tests/e2e`, `vite.config.ts`, `playwright.config.ts`, `tsconfig.json`, `index.html`.
**Прочитано полностью:** 10 файлов + CONTEXT и RESEARCH (строки 1-517 из 685; остаток RESEARCH, включая раздел тестовой стратегии, исполнитель читает сам).
**Дата:** 2026-11-14
