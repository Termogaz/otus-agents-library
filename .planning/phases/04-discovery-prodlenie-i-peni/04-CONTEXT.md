# Phase 4: Discovery «продление и пени» - Context

**Gathered:** 2026-10-26
**Status:** Ready for planning (реализация — следующая веха, LOAN-01; в фазе 4 код не меняется)

<domain>
## Phase Boundary

Фаза 4 — только Discovery: зафиксировать, ЧТО (SPEC) и КАК (этот CONTEXT) делает фича продления
выдач и пеней за просрочку. Реализация — домен + API + UI + миграция хранилища — в следующей вехе
(LOAN-01). В фазе 4 `git diff --stat ca429d0 -- src tests` пуст.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**8 requirements are locked.** See `04-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `04-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- Доменные правила: продление, `fineFor`, блокировка должника, отметка оплаты, новые коды отказов
- Расширение `Loan` и миграция JSON-хранилища с версии 1
- API: продление, отметка оплаты, `fineKopecks` и `finePaid` в списке выдач
- UI: кнопки «Продлить» и «Отметить оплату», сумма пени, тексты отказов; e2e на продление и оплату

**Out of scope (from SPEC.md):**
- Изменения `src/` и `tests/` в фазе 4 — фаза только Discovery (DISC-01)
- Очередь и бронь книг — продление не зависит от ожидающих читателей
- Уведомления читателю о сроке и пене — нет канала доставки
- Касса, частичная оплата, прощение и отмена отметки оплаты — MVP: оплата только целиком
- SQLite, роли и авторизация — хранилище остаётся JSON, «библиотекарь» — любой пользователь UI

</spec_lock>

<decisions>
## Implementation Decisions

### Политика: где живут ставка, потолок и число продлений (открытый вопрос 2)
- **D-01:** `LoanPolicy` расширяется полями `maxRenewals` (2), `finePerDayKopecks` (1000),
  `fineCapKopecks` (30 000); значения — в `DEFAULT_LOAN_POLICY`. Отдельной `FinePolicy` нет.
- **D-02:** Сигнатура — `fineFor(loan, now, policy = DEFAULT_LOAN_POLICY)`, как у `checkoutBook`.
  Запрет P1 соблюдён: параметра «читатель» нет; политика подменяется только в тестах.
- **D-03:** `renewLoan` — в `src/domain/loans.ts` рядом с `returnBook`; `fineFor`, `hasDebt`,
  `markFinePaid` — в новом `src/domain/fines.ts`; `checkoutBook` и `renewLoan` импортируют `hasDebt`.

### Механизм миграции v1→v2 (открытый вопрос 4)
- **D-04:** Миграция — при чтении: `load()` видит `version: 1`, применяет чистую функцию
  `migrateV1toV2(raw)` и проверяет результат zod-схемой v2; v2 пишется на диск при следующем
  `persist()` (атомарно, временный файл + `rename`). Отдельного скрипта и шага при старте нет.
  `STORAGE_VERSION = 2`; любая версия, кроме 1 и 2, — `UNSUPPORTED_STORAGE_VERSION`.
  — **Reversibility:** one-way — после первой записи v2 файл не читается кодом v1; откат требует обратной миграции.
- **D-05:** Повреждённая запись в файле v1 (нет `dueAt`, не дата и т. п.) — `INVALID_STORAGE_FILE`
  для всего файла, файл не меняется. Миграция ничего не чинит и не выбрасывает молча.
- **D-06:** Резервной копии v1 перед записью v2 не делаем.

### Старые просроченные выдачи из v1 (открытый вопрос 5, запрет P2)
- **D-07:** Миграция ставит всем выдачам из v1 `fineExempt: true`; новые выдачи — `fineExempt: false`.
  Для `fineExempt` выдачи `fineFor` = 0: нет долга, `READER_HAS_DEBT` не срабатывает, оплата — `NO_FINE`.
  Признак `overdue` (`isOverdue`) не меняется и продолжает показывать просрочку; продление
  просроченной — по-прежнему `LOAN_OVERDUE`. Проверка P2 — тест, а не judgment.
  — **Reversibility:** one-way — флаг записывается в файл при миграции; снять освобождение задним числом — новая миграция.
- **D-08:** Уточнение SPEC R7: инвариант «для невозвращённой выдачи `overdue: false` ⇔ `fineKopecks: 0`»
  действует для выдач с `fineExempt: false`; у `fineExempt` выдачи возможно `overdue: true` при `fineKopecks: 0`.

### Имена (открытый вопрос 6)
- **D-09:** Поля `Loan`: `renewalCount: number` (0 по умолчанию), `finePaidAt: Date | null`
  (как `returnedAt`; дата — из `now`), `fineExempt: boolean`. В API `finePaid = finePaidAt !== null`.
  — **Reversibility:** costly — имена попадают в формат файла v2 и в ответ API.
- **D-10:** Коды и пути — рабочие имена из SPEC становятся окончательными: `LOAN_OVERDUE`,
  `RENEWAL_LIMIT_REACHED`, `READER_HAS_DEBT`, `FINE_NOT_FINAL`, `NO_FINE`, `FINE_ALREADY_PAID`;
  `POST /api/loans/:id/renew`, `POST /api/loans/:id/pay-fine`.

### Claude's Discretion
- Тексты отказов на русском в `src/client/api.ts`, вид кнопок и колонки пени в UI — в пределах SPEC R8.
- Отдавать ли `fineExempt` в `GET /api/loans` — на усмотрение планировщика (UI в SPEC его не требует).
- Где лежит `migrateV1toV2` (в `json-file-repository.ts` или отдельном модуле `src/server/`) — планировщик.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Требования
- `.planning/phases/04-discovery-prodlenie-i-peni/04-SPEC.md` — Locked requirements — MUST read before planning
- `.planning/notes/renewal-and-fines.md` — решения и отклонённые варианты из `/gsd-explore`
- `.planning/research/questions.md` §«Продление и пени» — исходные открытые вопросы
- `.planning/ROADMAP.md` §Phase 4 — критерии успеха фазы Discovery

### Правила проекта
- `AGENTS.md` — слои (`domain` без I/O), `now: Date` параметром, типизированные отказы, миграция при смене формата, TDD

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/domain/loans.ts`: `DEFAULT_LOAN_POLICY`, `DAY_MS`, `isOverdue` — основа для `renewLoan` и `fineFor`
- `src/domain/types.ts`: `Loan`, `LoanPolicy`, `LoanErrorCode`, `LoanResult` — расширяются новыми полями и кодами
- `src/server/json-file-repository.ts`: `StorageError` с кодами `UNSUPPORTED_STORAGE_VERSION` / `INVALID_STORAGE_FILE`, атомарный `persist()`

### Established Patterns
- Отказ домена — `{ ok: false, code }`; маршрут отвечает `409` с кодом, неизвестная выдача — `404 LOAN_NOT_FOUND`
- Мутирующие маршруты — через `serial()` в `src/server/app.ts`
- Проверка версии файла идёт до zod-схемы — точка вставки миграции

### Integration Points
- `load()` в `json-file-repository.ts` — миграция v1→v2
- `src/server/app.ts` — маршруты `/renew`, `/pay-fine`, поля `fineKopecks`/`finePaid` в `GET /api/loans`
- `src/client/api.ts` — русские тексты новых кодов; список выдач в UI — кнопки и сумма

</code_context>

<specifics>
## Specific Ideas

- Отметка оплаты повторяет паттерн `returnedAt`: `null` — нет, дата — когда.
- Фикстуры v1 для тестов миграции: обычный файл, пустой `loans`, повреждённая запись, `version: 99`.

</specifics>

<deferred>
## Deferred Ideas

- Перенос миграций на SQLite (версионирование схемы) — вместе с переходом на SQLite
- Резервная копия файла перед миграцией — отклонено для MVP (D-06)
- Пеня по выдачам v1 от момента миграции (`fineFrom`) — отклонено в пользу `fineExempt` (D-07)
- Очередь/бронь, уведомления, касса и частичная оплата, прощение пени, роли — вне скоупа SPEC

</deferred>

---

*Phase: 04-discovery-prodlenie-i-peni*
*Context gathered: 2026-10-26*
