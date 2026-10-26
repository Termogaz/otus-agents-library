# Phase 4: Discovery «продление и пени» - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-26
**Phase:** 04-discovery-prodlenie-i-peni
**Areas discussed:** Где живут ставка и потолок, Механизм миграции v1→v2, Старые просрочки из v1, Имена полей, кодов, путей

Перед обсуждением: критерий фазы «`git diff --stat main -- src tests` пуст» заменён на
`git diff --stat ca429d0 -- src tests` (diff от `main` содержит тесты hooks фаз 1–3), коммит `418b73f`.

---

## Где живут ставка и потолок

| Option | Description | Selected |
|--------|-------------|----------|
| Расширить LoanPolicy | `maxRenewals`, `finePerDayKopecks`, `fineCapKopecks` в одной политике | ✓ |
| Отдельная FinePolicy | `LoanPolicy` + `FinePolicy { perDayKopecks, capKopecks }` | |

| Option | Description | Selected |
|--------|-------------|----------|
| Необязательный policy | `fineFor(loan, now, policy = DEFAULT_LOAN_POLICY)` | ✓ |
| Строго (loan, now) | Числа — константа модуля | |

| Option | Description | Selected |
|--------|-------------|----------|
| Новый fines.ts | `renewLoan` в `loans.ts`, правила пеней в `fines.ts` | ✓ |
| Всё в loans.ts | Один модуль | |
| На усмотрение планировщика | | |

## Механизм миграции v1→v2

| Option | Description | Selected |
|--------|-------------|----------|
| При чтении в load() | Чистая `migrateV1toV2`, v2 пишется при следующем `persist()` | ✓ |
| При старте сервера | `repo.migrate()` в `index.ts` до `listen` | |
| Отдельный скрипт | `npm run migrate`, сервер отклоняет v1 | |

| Option | Description | Selected |
|--------|-------------|----------|
| Отказ целиком | `INVALID_STORAGE_FILE`, файл не меняется | ✓ |
| Пропустить запись с логом | Потеря данных | |

| Option | Description | Selected |
|--------|-------------|----------|
| Нет бэкапа | Атомарная запись, учебные данные | ✓ |
| Да, library.v1.bak.json | Копия перед первой записью v2 | |

## Старые просрочки из v1

| Option | Description | Selected |
|--------|-------------|----------|
| Освободить все выдачи v1 | `fineExempt: true`, `fineFor` = 0, `overdue` остаётся | ✓ |
| Пеня от момента миграции | Поле `fineFrom = max(dueAt, migratedAt)` | |
| Задним числом, но явно | Пеня от `dueAt`, предупреждение в README | |

## Имена полей, кодов, путей

| Option | Description | Selected |
|--------|-------------|----------|
| renewalCount: number | | ✓ |
| renewals: number | | |

| Option | Description | Selected |
|--------|-------------|----------|
| finePaidAt: Date \| null | Как `returnedAt` | ✓ |
| finePaid: boolean | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Рабочие имена из SPEC | Коды и пути без изменений | ✓ |
| Переименовать FINE_NOT_FINAL | Например, `LOAN_NOT_RETURNED` | |

## Claude's Discretion

- Русские тексты отказов, вид кнопок и колонки пени
- Отдавать ли `fineExempt` в API
- Расположение `migrateV1toV2`

## Deferred Ideas

- Миграции для SQLite; бэкап перед миграцией; `fineFrom` для выдач v1
