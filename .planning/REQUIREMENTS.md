# Requirements: Библиотека — веха ДЗ-2

**Defined:** 2026-10-22
**Core Value:** Проверяющий по README и репозиторию видит, что каждый пункт текущего ДЗ выполнен и воспроизводим: настройка есть в git, есть доказательство работы (команда, скриншот, коммит).
**Источник:** `docs/homework-2.md`; исследование — `.planning/research/SUMMARY.md`.

## v1 Requirements

### Планирование GSD

- [x] **PLAN-01**: `ROADMAP.md`, `REQUIREMENTS.md`, `STATE.md` созданы; `/gsd-progress` показывает позицию вехи
- [x] **PLAN-02**: Единый источник плана — `docs/plan.md` становится указателем на `.planning/`; правило про прогресс в `AGENTS.md` согласовано с автором
- [ ] **PLAN-03**: `docs/architecture.md` описывает архитектуру среды агента (слои инструкций, планирования, памяти, hooks, контекста) со ссылкой на `.planning/codebase/ARCHITECTURE.md`
- [x] **PLAN-04**: Хотя бы одна фаза проходит полный цикл GSD: `PLAN.md` → выполнение → `VERIFICATION.md`

### Безопасность

- [x] **SEC-01**: `docs/security-checklist.md` — пункты из `CONCERNS.md` и ДЗ-1, у каждого команда проверки и статус (закрыт / открыт / воспроизводим из git)
- [x] **SEC-02**: Обходы чтения `.env` закрыты (`cat ./.env`, `grep … .env`, относительные пути в `reviewer`) и покрыты тестами
- [x] **SEC-03**: Правка `.claude/**` агентом требует подтверждения (`ask`)

### Память агента

- [x] **MEM-01**: claude-mem 15.0.1 установлен с локальным провайдером, телеметрия выключена; `doctor` зелёный
- [x] **MEM-02**: Канарейка: фальшивый ключ в выводе не находится в базе памяти
- [x] **MEM-03**: Доказательство «сессия A → сессия B»: факт, которого нет в файлах репозитория, агент вспоминает в новой сессии
- [ ] **MEM-04**: Запасной вариант («аналог») описан и рабочий: auto memory + `docs/memory.md` + `SessionStart`-дайджест

### Быстрые команды и auto hooks

- [ ] **HOOK-01**: Skills `/lib-check`, `/lib-status`, `/lib-handoff`, `/lib-commit`
- [ ] **HOOK-02**: Hook `SessionStart` (в закоммиченном `.claude/settings.json`) вставляет ветку, позицию GSD и верхнюю запись `docs/memory.md` (≤ 3 КБ)
- [ ] **HOOK-03**: Hook `PreCompact` пишет чек-пойнт в игнорируемый git каталог и всегда завершается с кодом 0
- [ ] **HOOK-04**: Логика hooks покрыта тестами Vitest; `npm run check` зелёный

### Управление контекстом

- [ ] **CTX-01**: Порог автосжатия задан и обоснован (`autoCompactWindow` или аналог)
- [ ] **CTX-02**: После сжатия `SessionStart(compact)` возвращает чек-пойнт; агент называет фазу, ветку и шаг
- [ ] **CTX-03**: Statusline GSD включён; монитор контекста выдаёт предупреждения
- [ ] **CTX-04**: Скриншоты `/context` и `/usage` до и после на одном сценарии, с подписями; политика контекста записана

### Discovery

- [ ] **DISC-01**: Discovery «продление и пени» пройден через GSD (`/gsd-explore` → SPEC → CONTEXT), без изменений в `src/` и `tests/`
- [ ] **DISC-02**: В SPEC зафиксированы открытые вопросы: срок и число продлений, ставка и потолок пени, блокировка выдачи, миграция формата хранилища

### Сдача

- [ ] **DOC-01**: README «Модуль 2» — таблица «пункт ДЗ → артефакт → команда → скриншот» и раздел «что не воспроизводится из git»
- [ ] **DOC-02**: PR `feat/module-2` → `main` на русском, без атрибуции, `npm run check` зелёный; тег `hw2-submitted` вручную

## v2 Requirements

### Безопасность

- **SEC-04**: Сузить `.claude/settings.local.json` — широкие allow от установщика GSD (`git commit *`, `pkill *`, `claude mcp *`)

### Продукт

- **LOAN-01**: Реализация продления и пеней по SPEC из DISC-01 — следующая веха

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Код продукта (продление, пени, SQLite) | В этой вехе только Discovery; реализация — следующие ДЗ |
| Остальные находки `CONCERNS.md` (дубли формы, общий файл данных e2e, нет CI) | Фиксируются в security-checklist как «открыто» |
| `hooks.community`, `/gsd-autonomous`, `/gsd-new-milestone` в этой вехе | Дублируют инъекцию контекста или переписывают веху |
| Вторая система памяти (MemPalace и т.п.) | Дублирует claude-mem |
| Генерация `.claude/CLAUDE.md` от GSD | Второй файл инструкций рядом с `AGENTS.md` |

## Traceability

| Requirement | Phase | Status |
| ----------- | ----- | ------ |
| PLAN-01 | Phase 1 | Complete |
| PLAN-02 | Phase 1 | Complete |
| PLAN-03 | Phase 5 | Pending |
| PLAN-04 | Phase 1 | Complete |
| SEC-01 | Phase 1 | Complete |
| SEC-02 | Phase 1 | Complete |
| SEC-03 | Phase 1 | Complete |
| MEM-01 | Phase 2 | Complete |
| MEM-02 | Phase 2 | Complete |
| MEM-03 | Phase 2 | Complete |
| MEM-04 | Phase 2 | Pending |
| HOOK-01 | Phase 2 | Pending |
| HOOK-02 | Phase 2 | Pending |
| HOOK-03 | Phase 2 | Pending |
| HOOK-04 | Phase 2 | Pending |
| CTX-01 | Phase 3 | Pending |
| CTX-02 | Phase 3 | Pending |
| CTX-03 | Phase 3 | Pending |
| CTX-04 | Phase 3 | Pending |
| DISC-01 | Phase 4 | Pending |
| DISC-02 | Phase 4 | Pending |
| DOC-01 | Phase 5 | Pending |
| DOC-02 | Phase 5 | Pending |

**Coverage:**

- v1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0 ✓

---

_Requirements defined: 2026-10-22_
_Last updated: 2026-10-22 after roadmap creation_
