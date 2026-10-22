# Phase 1: Базовая линия, единый план и гигиена безопасности - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-22
**Phase:** 1-Базовая линия, единый план и гигиена безопасности
**Areas discussed:** Единый план, Обходы .env, Защита .claude/, Security-checklist

---

## Единый план

| Вопрос | Варианты | Выбрано |
|--------|----------|---------|
| Что сделать с `docs/plan.md`? | История + указатель / Только указатель / Удалить файл | История + указатель |
| Что подключает `CLAUDE.md`? | `@.planning/STATE.md` / `@.planning/ROADMAP.md` / Ничего | `@.planning/STATE.md` |
| Правило `AGENTS.md:72` | Прогресс через GSD / GSD + отметка в plan.md | Прогресс через GSD |
| Roadmap следующих модулей | В `.planning/PROJECT.md` / Оставить в plan.md | В `.planning/PROJECT.md` |

---

## Обходы .env

| Вопрос | Варианты | Выбрано |
|--------|----------|---------|
| Где закрывать чтение через Bash | Наш hook + deny / Только deny-шаблоны / Опереться на GSD guard | Наш hook + deny |
| `gsd-secret-read-guard` | Оставить + записать / Отключить | Оставить + записать |
| Секретные имена | Все `.env*`, кроме шаблонов / Все `.env*` без исключений | Все `.env*`, кроме шаблонов |
| `git add -f .env` | Да, в том же hook / Нет, в checklist «открыт» | Да, в том же hook |

---

## Защита .claude/

| Вопрос | Варианты | Выбрано |
|--------|----------|---------|
| Охват `ask` | Весь `.claude/**` / Только наша конфигурация | Весь `.claude/**` |
| Запись через Bash | Запрос (ask) / Отказ (deny) / Не ловить | Запрос (ask) |

---

## Security-checklist

| Вопрос | Варианты | Выбрано |
|--------|----------|---------|
| Охват | Среда агента + главное в API / Только среда агента / Всё из CONCERNS.md | Среда агента + главное в API |
| Формат | Таблица / Раздел на пункт | Таблица |
| Команды проверки | Тест где можно, иначе ручная / Только shell-команды | Тест где можно, иначе ручная |

---

## Claude's Discretion

- Синтаксис deny/ask-шаблонов, общий модуль секретных имён, разбиение на планы, запись в `docs/memory.md`.

## Deferred Ideas

- Hook против `git commit` на `main`; проверка `node_modules` в `SessionStart`; SEC-04; лимиты и авторизация API.
