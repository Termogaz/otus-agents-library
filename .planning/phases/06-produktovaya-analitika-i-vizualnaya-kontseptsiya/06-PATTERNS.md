# Фаза 6: Продуктовая аналитика и визуальная концепция - карта паттернов

**Составлено:** 2026-10-31
**Файлов:** 10 (изменяемых 8, новых 2)
**Аналоги найдены:** 10 / 10 (все отслеживаются git: `git ls-files` подтверждён для src/client, tests/e2e, index.html)

Код в фазе не пишется. Карта нужна плану изменения `src/client`. RESEARCH.md нет. Файлы взяты из CONTEXT.md (D-01..D-13) и `docs/handoff/context.md`. Домен, сервер и `data/library.json` не меняются.

## Классификация файлов

| Файл | Роль | Поток данных | Аналог | Качество |
|------|------|--------------|--------|----------|
| `src/client/App.tsx` (изм.) | компонент-контейнер, состояние | request-response | он сам, `run()` строки 29-40 | точное |
| `src/client/LoansSection.tsx` (изм.) | компонент, форма и таблица | request-response | он сам | точное |
| `src/client/BooksSection.tsx` (изм.) | компонент, форма и таблица | CRUD | он сам | точное |
| `src/client/ReadersSection.tsx` (изм.) | компонент, список -> таблица | CRUD | `BooksSection.tsx` (таблица, строки 42-64) | точное |
| `src/client/api.ts` (изм., по необходимости) | утилита, типы и тексты ошибок | request-response | он сам, `messages` и `errorMessage` | точное |
| `index.html` (изм.) | конфиг, ссылка на шрифт | статика | он сам, комментарий у `<link rel="icon">` | точное |
| `src/client/styles.css` (новый) | стили, токены | статика | аналога нет, см. раздел «Без аналога» | нет |
| `src/client/main.tsx` (изм.) | точка входа, импорт CSS | статика | он сам | точное |
| `tests/e2e/loans.spec.ts` (не меняется, новые e2e идут в новых файлах) | тест | request-response | он сам | точное |
| `tests/e2e/smoke.spec.ts` (не ломать) | тест | request-response | он сам | точное |

## Назначение паттернов

### `src/client/App.tsx` (контейнер, FR-2, FR-5, D-03..D-05)

**Аналог:** текущий `App.tsx`.

**Импорты (строки 1-5), сохранить стиль:**
```typescript
import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage, type BookView, type LoanView, type ReaderView } from './api';
import { BooksSection } from './BooksSection';
```

**Что менять, `run()` (строки 29-40):**
```typescript
async function run(action: () => Promise<unknown>): Promise<boolean> {
  try {
    await action();
    setError(null);
    await refresh();   // сбой refresh сейчас выглядит как отказ действия
    return true;
  } catch (e) {
    setError(errorMessage(e));
    return false;
  }
}
```
Действие и `refresh()` разнести в отдельные `try`. Один глобальный `error` заменить на сообщение с полем «раздел» (книги/читатели/выдачи/возврат), чтобы выводить его под кнопкой формы (D-03) или над таблицей выдач (D-05). Успех остаётся до следующего действия, без таймеров (D-04). Прокрутка к сообщению: `ref` и `scrollIntoView` в `useEffect` (D-05).

**Ограничения:**
- `role="alert"` только один и только для отказа (`loans.spec.ts` строка 39). Успех и подсказка идут через `role="status"` или обычный текст.
- Строка `API: {apiStatus}` (строка 45) переезжает в `<footer>` и остаётся видимой (`smoke.spec.ts`).
- Порядок: «Выдачи» первым, ниже «Книги» и «Читатели» в две колонки 5:3 (D-01, D-10).
- Ошибка начальной загрузки (строка 26) остаётся отдельным состоянием («сбой API»).

### `src/client/LoansSection.tsx` (D-02, D-05, D-07, FR-4, FR-6)

**Аналог:** текущий файл.

**Сохранить без изменений:**
```typescript
// Выбор не сбрасывается после выдачи: удобно выдать ещё раз или увидеть отказ
const [bookId, setBookId] = useState('');
const [readerId, setReaderId] = useState('');
```
```typescript
<form aria-label="Выдать книгу" onSubmit={submit}>
  <label>Книга{' '}<select value={bookId} ... required>
```
Названия `option` равны `book.title` ровно, без счётчиков (`selectOption({ label: title })`). Доступные имена форм, подписей и кнопок («Выдать», «Вернуть») и `caption` таблицы «Выдачи» (`getByRole('table', { name: 'Выдачи' })`) не менять.

**Расширить:** функция `status()` (строки 12-15) задаёт текст статуса. Цвет добавлять классом по статусу (просрочена -> оранжевый, возвращена -> серый), текст оставлять всегда (NFR-2, D-07). Дата возврата: у `LoanView` есть `returnedAt`, `formatDate` (строки 17-19) переиспользовать. Добавить сообщение под кнопкой «Выдать» (подтверждение или отказ) и итог возврата над таблицей. Подсказки FR-6 не должны быть `alert`. Минимальная высота строки 44 px (D-09). Текст первого запуска: «сначала добавьте книгу и читателя» при пустых `books` или `readers` (D-02).

### `src/client/BooksSection.tsx` (D-03)

**Аналог:** текущий файл. Форма отправляется так:
```typescript
const added = await onAdd({ title: String(data.get('title')), ... });
if (added) form.reset();
```
Сохранить. Под кнопкой «Добавить» вывести сообщение раздела. Подписи полей («Название», «Автор», «ISBN», «Экземпляров») и текст «N из M» в ячейке (`toContainText('1 из 1')`) не менять. `caption` «Книги» остаётся.

### `src/client/ReadersSection.tsx` (D-11)

**Аналог:** таблица из `BooksSection.tsx` строки 42-64:
```typescript
<table>
  <caption>Книги</caption>
  <thead><tr><th>Название</th>...</tr></thead>
  <tbody>
    {books.map((book) => (<tr key={book.id}><td>{book.title}</td>...</tr>))}
  </tbody>
</table>
```
Заменить `<ul aria-label="Читатели">` (строки 34-40) на `<table>` с `caption` «Читатели» и колонками «Имя» и «Контакт». Форму (строки 24-32, подписи «Имя», «Контакт») не менять. В e2e список читателей не проверяется.

### `index.html` и `src/client/main.tsx` (D-08)

**index.html:** добавить в `<head>` рядом с иконкой, в том же стиле с русским комментарием:
```html
<!-- Пустая иконка: без неё браузер запрашивает /favicon.ico и пишет 404 в консоль -->
<link rel="icon" href="data:," />
```
`<link rel="preconnect">` и `<link rel="stylesheet">` на Google Fonts (IBM Plex Sans, подмножество cyrillic). Системный шрифт запасным в `font-family`. Пакет шрифта не ставить (NFR-3).

**main.tsx:** добавить `import './styles.css';` до `import { App }` (Vite подхватывает CSS без плагинов).

### `tests/e2e/loans.spec.ts` (D-13, S-2)

**Аналог:** текущий тест, строки 1-45. Образец стиля:
```typescript
const tag = randomUUID().slice(0, 8);
const loanForm = page.getByRole('form', { name: 'Выдать книгу' });
await loanForm.getByLabel('Книга').selectOption({ label: title });
await expect(page.getByRole('alert')).toHaveText('Нет свободных экземпляров');
```
Новые проверки (сообщения под формой, итог возврата, таблица читателей) писать отдельными тестами по `.claude/rules/e2e.md`: роли и текст, без CSS-селекторов, без `waitForTimeout`, web-first `expect`, имя теста на английском, уникальные данные через `tag`. Существующий сценарий не ослаблять.

## Общие паттерны

### Тексты ошибок
**Источник:** `src/client/api.ts` строки 31-45 (`messages`, `errorMessage`). Сообщения брать отсюда, при необходимости добавить коды в `messages`. Код ошибки домена не менять. Формулировки по DESIGN.md и `ux-patterns.md`.

### Колбэки разделов
**Источник:** `App.tsx` строки 48-56. Разделы получают `onAdd`, `onCheckout`, `onReturn` с `Promise<boolean>`. Сохранить сигнатуру или расширить результатом (код/текст), оставив `boolean`-логику сброса формы.

### Стиль
Комментарии на русском, `kebab-case.ts`, компоненты `PascalCase.tsx`, TypeScript strict без `any`. Новых npm-зависимостей нет.

## Без аналога

| Файл | Роль | Поток | Причина |
|------|------|-------|---------|
| `src/client/styles.css` | стили, токены | статика | CSS в `src/client` нет. Брать значения палитры D-06 и контраст из `DESIGN.md`, образец состояний из `docs/mockups/main-screen.html` (не из `main-screen-prime.html`) |

## Метаданные

**Область поиска:** `src/client`, `tests/e2e`, `index.html`, `docs/handoff/context.md`
**Прочитано файлов:** 12
**Дата:** 2026-10-31
