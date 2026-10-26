# Библиотека — учебный полигон OTUS «ИИ-агенты»

## What This Is

Веб-приложение библиотеки (книги с экземплярами, читатели, выдача и возврат, лимит, срок,
просрочка) на fullstack TypeScript, вокруг которого выстроена AI-ориентированная среда
разработки с Claude Code. Проект — полигон для домашних заданий курса OTUS
«ИИ-агенты: продвинутое внедрение и использование»: ДЗ-1 сдано (тег `hw1-submitted`),
текущая веха — ДЗ-2, дальше проект используется для ДЗ-3…ДЗ-8. Читатель результата —
проверяющий курса и автор проекта.

## Core Value

Проверяющий по README и репозиторию видит, что каждый пункт текущего ДЗ выполнен и
воспроизводим: настройка есть в git, есть доказательство работы (команда, скриншот, коммит).

## Requirements

### Validated

<!-- Сделано в ДЗ-1 (тег hw1-submitted) и выведено из карты кода .planning/codebase/. -->

- ✓ Книги: название, автор, ISBN, количество экземпляров; список с доступностью — ДЗ-1
- ✓ Читатели: имя, контакт — ДЗ-1
- ✓ Выдача и возврат; нельзя выдать без свободного экземпляра; лимит 3 книги; срок 14 дней; статус «просрочена» — ДЗ-1 (`src/domain/loans.ts`)
- ✓ API Express 5 + zod, отказ домена → `409` с кодом; хранилище — JSON-файл за интерфейсом репозитория — ДЗ-1
- ✓ React UI выдачи и возврата, e2e Playwright «выдать → вернуть» — ДЗ-1
- ✓ Среда агента: `AGENTS.md`, rules с `paths:`, skills `write-tests`/`review-step`, permissions, hooks `format-and-lint`/`protect-files`, read-only `reviewer`, Playwright MCP, `docs/memory.md` — ДЗ-1
- ✓ GSD Core 1.18.0 установлен локально, карта кода `.planning/codebase/` — ДЗ-2, шаг 1а–1б

### Active

<!-- Веха v1 = ДЗ-2. Текст задания: docs/homework-2.md. -->

- [ ] GSD-проект инициирован: roadmap, plan, progress, architecture, security-checklist
- [ ] Память агента между сессиями (claude-mem или аналог) подключена и проверена
- [ ] Быстрые команды и auto hooks (`SessionStart`, `PreCompact`) настроены
- [ ] Управление контекстом (автосжатие / чек-пойнты) внедрено, скриншоты usage до и после
- [ ] Пройден Discovery в GSD для следующей вехи «продление и пени»
- [ ] README «Модуль 2» описывает результаты для проверки; PR в `main`; `npm run check` зелёный

### Out of Scope

- Код продления и пеней — в этой вехе только Discovery; реализация — в следующей вехе
- Хранилище: SQLite + миграции вместо JSON — будущая веха (roadmap, перенесён из `docs/plan.md`)
- Тесты: отдельный файл данных для e2e, чтобы e2e не засорял `data/library.json` dev-сервера; сервер уже читает путь из `LIBRARY_DATA_FILE`, осталось передать его в `webServer` в `playwright.config.ts` — будущая веха (roadmap, перенесён из `docs/plan.md`)
- Правила: бронирование и очередь, продление, пени, блокировка должников — будущая веха (roadmap, перенесён из `docs/plan.md`)
- Роли: библиотекарь / читатель, авторизация — будущая веха (roadmap, перенесён из `docs/plan.md`)
- Интеграции: карточка книги по ISBN (Open Library), поиск, рекомендации через LLM — будущая веха (roadmap, перенесён из `docs/plan.md`)
- Эксплуатация: фоновое напоминание о просрочке, деплой, логи — будущая веха (roadmap, перенесён из `docs/plan.md`)
- Исправление находок `CONCERNS.md` (дубли при отправке формы, общий файл данных e2e) — фиксируются в security-checklist и бэклоге, чинятся отдельными задачами
- Новые npm-зависимости проекта без согласования — правило `AGENTS.md`

## Context

- Brownfield: MVP и среда агента готовы в ДЗ-1; карта кода — `.planning/codebase/`
  (STACK, ARCHITECTURE, STRUCTURE, CONVENTIONS, TESTING, INTEGRATIONS, CONCERNS).
- Правила проекта — `AGENTS.md` (через `CLAUDE.md`); журнал сессий — `docs/memory.md`;
  отчёт ДЗ-1 — `docs/about.md`, README.
- Шаги модуля 2 до инициализации GSD велись в `docs/plan.md`; после неё единый источник
  плана — `.planning/ROADMAP.md`, `docs/plan.md` ссылается на него.
- `CONCERNS.md` нашёл обходы агентных запретов (относительные пути `./.env`, правка
  `.claude/settings.json` агентом) — вход для security-checklist.
- Окружение: WSL, Node 24 через nvm (нужен GSD), npm без прокси (`env -u http_proxy ...`).

## Constraints

- **Процесс**: ветки `feat/*`, в `main` только через PR; Conventional Commits, описание на русском; без атрибуции агента — правила `AGENTS.md`
- **Качество**: задача готова только при зелёном `npm run check` (и `npm run test:e2e` для UI)
- **Зависимости**: новые npm-пакеты и плагины — только по согласованию с автором
- **Безопасность**: `.env*` не читать и не менять; не ослаблять permissions/hooks/линтер
- **Язык**: документы, UI, коммиты — на русском; имена тестов и идентификаторы — на английском
- **Шаги**: каждый шаг обсуждается и выполняется после подтверждения автора

## Key Decisions

| Decision | Rationale | Outcome |
| -------- | --------- | ------- |
| Веха v1 GSD = шаги ДЗ-2 (процесс), а не фичи продукта | Цель сейчас — сдать ДЗ-2; фичи — следующие вехи | — Pending |
| `.planning/` в git, вне Prettier | План — часть сдачи; файлы пишут скрипты GSD | — Pending |
| Discovery — тема «продление и пени» | Задел под следующие ДЗ, уже был в roadmap ДЗ-1 | — Pending |
| Файлы самого GSD Core — вне git (переустановка `npx @opengsd/gsd-core@1.18.0`) | Сторонний код, не результат работы | ✓ Good |
| `commit_docs: false` — `.planning/` коммитим вручную, сообщения на русском | Автокоммиты GSD на английском противоречат `AGENTS.md` | — Pending |
| `git.create_tag: false` — тег `hw2-submitted` ставим вручную | Как `hw1-submitted`, без тегов GSD вида `v1.0` | — Pending |
| Не генерировать `.claude/CLAUDE.md` от GSD | Второй файл инструкций дублирует `AGENTS.md`; ссылку на GSD добавим в фазе 1 по согласию | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):

1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):

1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

_Last updated: 2026-10-22 after initialization_
