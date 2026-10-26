# Architecture Research

**Domain:** агентно-ориентированный пайплайн разработки вокруг Claude Code (память, быстрые команды, auto hooks, управление контекстом, документы планирования GSD) в существующем brownfield-проекте
**Researched:** 2026-10-22
**Confidence:** HIGH по составу и поведению локальных файлов (прочитаны `settings.json`, `settings.local.json`, hooks, `config.json`, шаблоны GSD) и по семантике hooks Claude Code (официальная документация); MEDIUM по `claude-mem` и по `gsd-statusline` / `gsd-surface` (описания из документации, не запускались)

> Область: только среда агента и документы. Архитектура самого приложения (domain → server → client) не меняется;
> её описание уже есть в `.planning/codebase/ARCHITECTURE.md` и здесь не дублируется.

## Ключевые выводы (коротко)

1. **Один источник на один вид факта.** После инициализации GSD: «что делаем и как далеко» = `.planning/ROADMAP.md` + `STATE.md`; «почему так решили» = `PROJECT.md` (Key Decisions); «правила работы» = `AGENTS.md`; «что случилось в сессии, на чём споткнулись» = `docs/memory.md`. `docs/plan.md` становится тонкой ссылкой, а не вторым планом.
2. **У GSD уже есть свои hooks, и они живут в `.claude/settings.local.json` (вне git).** Наши hooks остаются в `.claude/settings.json` (в git). Claude Code объединяет оба файла и запускает совпавшие hooks параллельно, поэтому конфликтов порядка нет, но и порядка исполнения нет. Копировать hooks GSD в `settings.json` нельзя.
3. **`SessionStart` и `PreCompact` нужны проекту сами (доказательство для ДЗ должно быть в git), но не должны повторять GSD.** Связка: `PreCompact` пишет checkpoint-файл (контекст он вставить не может), `SessionStart` с источником `compact`/`startup`/`resume` читает его и состояние GSD и вставляет короткий дайджест.
4. **Монитор контекста GSD сейчас не работает.** `gsd-context-monitor.js` читает метрики из файла, который пишет `gsd-statusline.js`, а `statusLine` не настроен ни в одном `settings*.json`. Без него предупреждения 35% / 25% не приходят. Это обязательный шаг для пункта «управление контекстом».
5. **Три слоя памяти с правилом «повышения»:** автоматическая (`claude-mem`, вне git) → журнал (`docs/memory.md`, в git) → структурированное состояние (`STATE.md` / `PROJECT.md`, пишет GSD). Устойчивые ловушки поднимаются в `AGENTS.md`.

## Standard Architecture

### System Overview

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ 1. СЛОЙ ИНСТРУКЦИЙ (грузится в каждую сессию; в git)                         │
│  CLAUDE.md ─@→ AGENTS.md ; @→ docs/plan.md (станет тонким)                   │
│  .claude/rules/*.md (paths:)  .claude/skills/*  .claude/agents/reviewer      │
├──────────────────────────────────────────────────────────────────────────────┤
│ 2. СЛОЙ ПЛАНИРОВАНИЯ — GSD (в git, пишут скрипты GSD)                        │
│  .planning/PROJECT.md  REQUIREMENTS.md  ROADMAP.md  STATE.md  config.json    │
│  .planning/phases/NN-*/ {PLAN, SUMMARY, VERIFICATION, SECURITY}.md           │
│  .planning/codebase/*  (карта кода, только читается)  .planning/research/*   │
├──────────────────────────────────────────────────────────────────────────────┤
│ 3. СЛОЙ ДОКУМЕНТОВ ДЛЯ ПРОВЕРЯЮЩЕГО (в git, пишет человек/агент)             │
│  README «Модуль 2»  docs/architecture.md  docs/security-checklist.md         │
│  docs/memory.md  docs/plan.md (ссылка)  docs/homework-2.md (текст ДЗ)        │
├───────────────────────────┬───────────────────────────┬──────────────────────┤
│ 4. ПАМЯТЬ                 │ 5. АВТОМАТИКА             │ 6. КОНТЕКСТ          │
│ claude-mem (~/.claude-mem,│ .claude/settings.json:    │ statusLine +         │
│  вне git)                 │  protect-files,           │  gsd-context-monitor │
│ built-in auto memory      │  format-and-lint,         │ PreCompact →         │
│  (~/.claude/projects/…)   │  SessionStart, PreCompact │  checkpoint-файл     │
│ docs/memory.md (журнал)   │ settings.local.json:      │ SessionStart(compact)│
│ STATE.md (позиция)        │  18 hooks GSD (вне git)   │  → дайджест          │
│                           │ .claude/skills: /check…   │ /gsd-pause-work      │
└───────────────────────────┴───────────────────────────┴──────────────────────┘
                 ▲                           ▲                         ▲
                 └──── читают при SessionStart / PostCompact ──────────┘
```

### Component Responsibilities

| Компонент | Отвечает за | Пишет | Читает | В git |
|-----------|-------------|-------|--------|-------|
| `AGENTS.md` (через `CLAUDE.md`) | Правила работы, команды, запреты, ловушки окружения | человек | каждая сессия | да |
| `docs/plan.md` (после сокращения) | Указатель: где план, где история ДЗ-1 (тег `hw1-submitted`) | человек | каждая сессия (`@import`) | да |
| `.planning/PROJECT.md` | Зачем проект, Requirements (Validated/Active/Out of Scope), **Key Decisions** | GSD-workflows + человек | GSD, агент | да |
| `.planning/ROADMAP.md` | Фазы вехи ДЗ-2, критерии успеха, backlog (будущие модули) | `/gsd-new-project`, `/gsd-phase` | GSD, человек | да |
| `.planning/STATE.md` | Текущая позиция, блокеры, `Stopped at`, метрики | **только скрипты GSD** (`gsd-tools state …`, monitor при CRITICAL) | GSD, SessionStart-дайджест | да |
| `.planning/phases/NN-*/` | PLAN → SUMMARY → VERIFICATION → SECURITY по фазе | агенты GSD | GSD | да |
| `.planning/codebase/*` | Сгенерированная карта кода (`last_mapped_commit`) | `/gsd-map-codebase` | планировщики, `docs/architecture.md` по ссылке | да |
| `docs/memory.md` | Журнал сессий: Сделано / Решение / Дальше / Ловушки | агент по `/session-end` | SessionStart-дайджест (только верхняя запись) | да |
| `docs/architecture.md` | Архитектура **пайплайна агента** + ссылка на карту кода | человек/агент | проверяющий | да |
| `docs/security-checklist.md` | Постоянные контроли и их статус; вход из `CONCERNS.md` | человек/агент | проверяющий, `/gsd-secure-phase` | да |
| `claude-mem` | Автоматическая эпизодическая память между сессиями | сам плагин | сам плагин (инъекция при старте, поиск) | нет (`~/.claude-mem/`) |
| hooks проекта (`.claude/hooks/*.ts`) | protect-files, format-and-lint, session-start, pre-compact | — | stdin Claude Code | да |
| hooks GSD (`.claude/hooks/gsd-*`) | guard'ы, context-monitor, check-update | — | stdin Claude Code | нет (`.gitignore`), конфиг hooks — в `settings.local.json` |
| skills-«быстрые команды» | `/check`, `/session-end`, `/checkpoint` | — | вызывает человек | да |

## Единый источник правды (SSOT): правила

| Вид факта | Единственный дом | Остальные места |
|-----------|------------------|-----------------|
| Список и статус шагов ДЗ-2 | `ROADMAP.md` (чекбоксы фаз) и `STATE.md` (позиция) | `docs/plan.md` — одна ссылка; README — ссылка на ROADMAP |
| Требования веки | `PROJECT.md` → Active (+ `REQUIREMENTS.md`, если создаст GSD) | `docs/homework-2.md` — исходный текст, не редактируется |
| Решения и причины | `PROJECT.md` → Key Decisions | `docs/memory.md` пишет «Решение» одной строкой со ссылкой, не копирует таблицу |
| Правила кода/процесса, команды | `AGENTS.md` | `docs/plan.md` не повторяет стек/структуру |
| Ловушки сессии | `docs/memory.md`; постоянные — поднять в `AGENTS.md` → «Ловушки окружения» | `claude-mem` хранит сам, не источник |
| Позиция «где остановились» | `STATE.md` | `docs/memory.md` → «Дальше» = одна строка + `/gsd-progress` |
| Описание кода (слои, потоки) | `.planning/codebase/ARCHITECTURE.md` (генерируется) | `docs/architecture.md` ссылается, не копирует |
| Угрозы по фазе | `.planning/phases/NN-*/NN-SECURITY.md` (шаблон GSD) | `docs/security-checklist.md` ссылается по ID контроля |

### `docs/plan.md` против `ROADMAP.md` / `STATE.md`

`PROJECT.md` уже зафиксировал решение: после инициализации GSD единый источник плана — `.planning/ROADMAP.md`, а `docs/plan.md` на него ссылается. Чтобы это было правдой, а не декларацией:

- `docs/plan.md` сокращается до ~20–30 строк: назначение, ссылки на `ROADMAP.md`/`STATE.md`/`PROJECT.md`, указание «история ДЗ-1 — `git show hw1-submitted:docs/plan.md`». Таблицы «Стек», «Структура», «MVP», «Запреты» уже покрыты `AGENTS.md`, `PROJECT.md` (Validated) и `docs/about.md` — перед удалением сверить диффом.
- Раздел «Roadmap (следующие модули)» переносится в backlog `ROADMAP.md` (`/gsd-phase`, `add-backlog`), а не остаётся в двух местах.
- `CLAUDE.md` продолжает импортировать **только** `docs/plan.md`. `ROADMAP.md` и `STATE.md` в `@import` не добавлять: `STATE.md` пишут скрипты и он меняется внутри сессии, импорт даёт устаревший срез и раздувает контекст. Свежую позицию доставляет SessionStart-дайджест (ниже).
- Побочный эффект: `docs/plan.md` весит 11,5 КБ и грузится в каждую сессию (вместе с `AGENTS.md`, 8 КБ). Сокращение — прямой вклад в «после» для скриншота usage.
- **Требует согласования с автором:** `AGENTS.md` сегодня говорит «отмечать прогресс в `docs/plan.md`». Правка одной строки («…в `.planning/ROADMAP.md`; позицию ведёт GSD») — изменение правил, по `AGENTS.md` нужно остановиться и спросить.

### `docs/memory.md` против `STATE.md` против инструмента памяти

| Вопрос | `STATE.md` | `docs/memory.md` | `claude-mem` |
|--------|------------|------------------|--------------|
| Природа | Структурированная позиция в workflow | Курируемый журнал для человека | Автоматический лог наблюдений |
| Кто пишет | Скрипты GSD | Агент по команде `/session-end` (требование `AGENTS.md`) | Хуки плагина |
| Что внутри | Фаза/план/статус, блокеры, `Stopped at` | Сделано, Решение, Дальше, Ловушки | Что делал агент, summaries, поиск |
| Правда при расхождении | Для «где мы» — да | Для «почему и на чём споткнулись» — да | Никогда не источник; подсказка |
| Переживает `git clone` | Да | Да | Нет |
| В контекст при старте | Первые строки позиции (через наш дайджест) | Только верхняя запись (заголовок + «Дальше») | Собственная инъекция плагина |

Правило повышения (никогда вниз): наблюдение `claude-mem` → при ценности запись «Ловушки» в `docs/memory.md` → если постоянна, строка в `AGENTS.md`. Решение, влияющее на проект → `PROJECT.md` Key Decisions. Весь `docs/memory.md` (38 КБ, растёт) в контекст не читать.

### Где живут architecture и security-checklist

ДЗ требует «architecture, security-checklist» как часть инициированного проекта. Рекомендация: **человекочитаемые документы в `docs/`, машинные входы в `.planning/`**.

- `docs/architecture.md` — пишется вручную. Содержание: (1) одна диаграмма слоёв приложения и ссылка на `.planning/codebase/ARCHITECTURE.md`; (2) **архитектура пайплайна агента** — диаграмма этого документа, границы компонентов, потоки SessionStart/PreCompact, карта «кто что пишет». Главная ценность именно (2): код уже описан картой. Писать **после** реализации hooks и памяти, чтобы описывать построенное.
- `docs/security-checklist.md` — живой чек-лист постоянных контролей, колонки: ID, контроль, где реализован, **воспроизводим из git (да/нет)**, статус, проверка. Вход — раздел «Security Considerations» из `CONCERNS.md` (обходы префиксных `deny`, fail-open при отсутствии `node_modules`, агент правит свои настройки, `npx -y` у MCP, коммит в `main` мягким правилом). Новые поверхности этой вехи: `claude-mem` (что и куда пишет, cloud/local), новые hooks, GSD-guard'ы только в `settings.local.json`.
- `.planning/phases/NN-*/NN-SECURITY.md` — реестр угроз по фазе из шаблона GSD (`/gsd-secure-phase`; в `config.json` уже `security_enforcement: true`, `security_block_on: high`, ASVS 1). Ссылается на ID чек-листа, не копирует его.
- Не использовать `/gsd-docs-update` для создания `docs/architecture.md`: воркфлоу докс-писателя генерирует `docs/ARCHITECTURE.md` по своему шаблону и может перезаписать ручной файл (имя отличается регистром; на файловых системах без учёта регистра это один файл). Если запускать — только после появления ручных файлов и с проверкой `has_gsd_marker`.

## Hooks: как GSD и проект сосуществуют

### Факты (проверено по файлам)

- Наш `.claude/settings.json`: `PreToolUse` `Edit|Write|Bash` → `protect-files.ts`; `PostToolUse` `Edit|Write` → `format-and-lint.ts`. Запуск через `node_modules/.bin/tsx` (≈150 мс на вызов в замере; hooks GSD на Node ≈25 мс).
- `.claude/settings.local.json` (в `.gitignore`) содержит 18 hooks GSD: `SessionStart` (`gsd-check-update.js`, `gsd-session-state.sh`), `PreToolUse` (`gsd-prompt-guard`, `gsd-read-guard`, `gsd-workflow-guard`, `gsd-worktree-path-guard`, `gsd-agent-isolation-guard`, `gsd-write-guard`, `gsd-secret-read-guard`, `gsd-validate-commit`), `PostToolUse` (`gsd-context-monitor`, `gsd-read-injection-scanner`, `gsd-graphify-update`, `gsd-phase-boundary`), `SubagentStop`/`Stop`/`PreCompact` (`gsd-context-monitor`), `FileChanged` (`gsd-config-reload`).
- В `.planning/config.json` нет `hooks.community` и `hooks.workflow_guard`, поэтому **no-op**: `gsd-session-state.sh` (внедрение головы `STATE.md`), `gsd-phase-boundary.sh`, `gsd-validate-commit.sh`, `gsd-workflow-guard.js`. Активны: guard'ы записи/чтения, secret-read-guard, prompt-guard (advisory), injection-scanner, context-monitor, check-update, config-reload.
- Документация Claude Code: записи hooks из user/project/local **объединяются**, идентичные обработчики выполняются один раз, совпавшие hooks запускаются **параллельно**. `SessionStart` принимает `additionalContext`/plain stdout и matcher `startup|resume|clear|compact|fork`. `PreCompact` (matcher `manual|auto`, вход `trigger`, `custom_instructions`) может только заблокировать сжатие (exit 2 / `decision: block`); `systemMessage` и `continue` отбрасываются — **контекст из PreCompact вставить нельзя**. `PostCompact` получает `compact_summary`.

### Карта взаимодействий

| Событие | Hooks проекта (git) | Hooks GSD (локально) | Взаимодействие и решение |
|---------|---------------------|----------------------|--------------------------|
| `SessionStart` | **новый** `session-start.ts` | `gsd-check-update` (всегда), `gsd-session-state` (no-op) | Не включать `hooks.community`: он же включит `validate-commit`, `phase-boundary` и дубль инъекции `STATE.md`. Наш hook — единственный инжектор. |
| `PreCompact` | **новый** `pre-compact.ts` (checkpoint) | `gsd-context-monitor` (сброс сторожевых файлов, не пишет в проект) | Параллельны и независимы (разные файлы). Наш hook **всегда exit 0** — exit 2 заблокировал бы автосжатие. |
| `PreToolUse` Write/Edit/Bash | `protect-files` | `gsd-write-guard`, `gsd-secret-read-guard`, `gsd-prompt-guard`, `gsd-read-guard`, … | Решения не конфликтуют: любой отказ побеждает. Но GSD-guard'ы **не воспроизводятся из git**: в чек-листе помечать «локально». |
| `PostToolUse` Edit/Write | `format-and-lint` | `gsd-context-monitor`, `gsd-phase-boundary` (no-op) | Prettier игнорирует `.planning/` (коммит 618fa03) — документы GSD не переформатируются. |
| `Stop` / `SubagentStop` | — | `gsd-context-monitor` | Не дублировать. |
| `FileChanged` `config.json` | — | `gsd-config-reload` | Подхватывает правки `.planning/config.json` без перезапуска (пригодится при тонкой настройке порогов). |

### Границы владения

- Файл `settings.json` (git) — только наши hooks. Файл `settings.local.json` — только то, что ставит установщик GSD (и, при необходимости, `statusLine`, см. ниже). Переустановка `npx @opengsd/gsd-core@1.18.0 --claude --local` пересоздаёт GSD-часть, не затрагивая наши `.ts`.
- Наши hooks **не пишут** `STATE.md`: запись в него — зона `gsd-tools state …`, а `gsd-write-guard` блокирует Write, резко уменьшающий `ROADMAP.md`/`STATE.md`. Правки этих файлов агентом — только `Edit` или команды GSD.
- Все новые hooks — на TypeScript через `tsx`, как существующие, с тестами в `tests/unit/` (по образцу `protect-files.test.ts`): чистая функция сборки текста + тонкая обёртка ввода-вывода.
- `readHookInput()` в `.claude/hooks/lib/hook-input.ts` требует `tool_name` и `tool_input` — у `SessionStart`/`PreCompact` их нет, будет исключение. Нужна отдельная zod-схема события (`hook_event_name`, `source`/`trigger`, `cwd`, `session_id`), общий код — только `isMain`/`projectDir`.

## Auto hooks проекта: поток данных

```text
сессия работает
   │  context-monitor (PostToolUse) читает /tmp/claude-ctx-<session>.json,
   │  который пишет statusline; <=35% остатка → WARNING, <=25% → CRITICAL
   │  (CRITICAL: GSD сам пишет STATE.md "Stopped at: context exhaustion…")
   ▼
контекст заполняется ──► автосжатие / ручной /compact
   │
   ▼  PreCompact (matcher auto|manual)
pre-compact.ts ──► .claude/checkpoints/last.md   (gitignored, перезапись)
   │               ветка, git status --short, diff --stat, 3 последних коммита,
   │               позиция из STATE.md, активная фаза, trigger, время
   ▼  (Claude Code сжимает; контекст из hook'а НЕ вставляется)
SessionStart, source=compact
   ▼
session-start.ts ──► additionalContext (<2 КБ): ветка/чистота дерева, наличие
                     node_modules/.bin/tsx, позиция GSD, верхняя запись memory.md,
                     (для compact) содержимое checkpoint
```

`SessionStart` с `source=startup|resume|clear` делает то же без блока checkpoint. Правила дайджеста:

- Только то, чего нет в `AGENTS.md` и что меняется (позиция, состояние дерева, последний шаг). Лимит ≈2 КБ; все ошибки чтения — молча пропускать раздел, exit 0 (fail-open допустим для информационного hook'а, в отличие от `protect-files`).
- Заодно закрывает находку `CONCERNS.md` «fail-open при отсутствии `node_modules`»: дайджест печатает предупреждение «выполни `npm ci`: защитные hooks не работают», если нет `node_modules/.bin/tsx`. Но сам `session-start.ts` запускается через `tsx` и без него не стартует — поэтому для этой проверки нужна обёртка на `bash`/`node` без зависимостей (одна короткая команда в `settings.json`), иначе предупредить будет некому.
- Опционально `PostCompact` сохраняет `compact_summary` рядом с checkpoint — наглядное доказательство для ДЗ («что именно запомнил Claude после сжатия»). Не обязательно.

## Быстрые команды

- Форма: **skills** в `.claude/skills/<имя>/SKILL.md` с `disable-model-invocation: true` (вызывает только человек) — единообразно с `review-step` / `write-tests`. Команды GSD физически лежат в `.claude/commands/gsd-*` (вне git); собственные команды в `commands/` не класть, чтобы не смешивать с игнорируемым шаблоном.
- Минимальный набор (не дублирует GSD):
  - `/check` — `npm run check` и краткий итог (единственная форма «готово» по `AGENTS.md`).
  - `/session-end` — прогон `check`, запись в `docs/memory.md` по формату (Сделано / Решение / Дальше / Ловушки), напоминание `/gsd-pause-work`, если фаза не закончена.
  - `/checkpoint` — вызывает тот же модуль, что `pre-compact.ts`, и предлагает `/compact`. Один код, два входа.
- Не переписывать то, что уже даёт GSD: `/gsd-progress`, `/gsd-next`, `/gsd-resume-work`, `/gsd-pause-work`, `/gsd-fast`, `/gsd-quick`. В README описать их как «быстрые команды окружения» таблицей «задача → команда».
- Права: `/check` вызывает `npm run check`, он уже в `allow`; для `/checkpoint` понадобится точная запись в `allow` на запуск `tsx …/checkpoint.ts` (не префиксом).

## Память: подключение `claude-mem`

- Установка — плагин Claude Code (`/plugin marketplace add thedotmack/claude-mem`, `/plugin install claude-mem`) либо `npx claude-mem install`; `npm install -g claude-mem` hooks не регистрирует (MEDIUM, документация проекта).
- Хуки регистрирует сам плагин (`SessionStart`, `UserPromptSubmit`, `PostToolUse`, `Stop`), данные — `~/.claude-mem/` (SQLite + векторный поиск), локальный worker на 127.0.0.1. Это **user-level**: в git ничего не попадает, `package.json` не меняется, но ставятся Bun/uv и лаунчер в PATH → нужно согласие автора, как для любой установки (в духе правила `AGENTS.md` про зависимости).
- Установщик по умолчанию предлагает облачного провайдера «CMEM Pro» (OAuth с cmem.ai). Для учебного репозитория выбирать локальный режим и проверить, что уходит наружу; зафиксировать в `docs/security-checklist.md` (LOW–MEDIUM: страница установки не описывает теги приватности и отключение).
- Конфликтов с нашими hooks нет (плагинные hooks отдельны от `settings.json`), но на `SessionStart` будут три инжектора (GSD no-op, наш, `claude-mem`): держать наш дайджест коротким и не пересказывать то, что вспомнит `claude-mem`.
- Секреты: `claude-mem` фиксирует наблюдения о вызовах инструментов. Чтение `.env*` и так закрыто (`permissions.deny`, `gsd-secret-read-guard`); не ослаблять.
- **Проверка между сессиями** (критерий ДЗ): сессия 1 — выполнить помеченное действие и закончить; сессия 2 (новая) — спросить про него без подсказок и сохранить скриншот. Запланировать рано: нужны две отдельные сессии.
- Запасной вариант («аналог» по ДЗ): встроенная auto memory Claude Code (`~/.claude/projects/<проект>/memory/MEMORY.md`) уже работает в этом проекте, плюс `docs/memory.md` и SessionStart-дайджест. У GSD есть `gsd-mempalace-*`, но он требует внешнего MemPalace и `config.mempalace.enabled` — тяжелее и не нужен.
- Ловушка окружения из `docs/memory.md`: установщики из сети в этой WSL ведут себя по-разному с прокси и без (nvm зависал без прокси, npm падает с прокси). Для `claude-mem` заранее подготовить оба варианта.

## Управление контекстом

Слои, от дешёвого к дорогому:

1. **Не загружать лишнее.** Сокращение `docs/plan.md`; пути-ограниченные rules (уже есть); `docs/memory.md` не импортируется. Измеримо: `/context` — раздел memory files.
2. **Сократить поверхность навыков GSD.** Установлен профиль `full` (`.claude/.gsd-profile`): 72 команды и 35 агентов попадают в список доступных навыков в каждой сессии. `/gsd-surface profile <имя>` / `disable <кластер>` меняет это без переустановки (MEDIUM: описание команды прочитано, не запускалось). Если используется, добавить `.claude/.gsd-surface.json` в `.gitignore` (текущий шаблон `.claude/gsd-*` точку в начале имени не покрывает). Playwright MCP также занимает схемы инструментов — учесть в замере.
3. **Видеть заполнение.** Зарегистрировать `gsd-statusline.js` как `statusLine` — **в `settings.local.json`** рядом с остальными GSD-файлами (файл вне git, ссылка из `settings.json` на него ломалась бы на чистом клоне). Пороги настраиваются в `.planning/config.json`: `hooks.context_warning_threshold` (35) и `hooks.context_critical_threshold` (25), подхватываются `gsd-config-reload`. Для наглядной демонстрации допустимо временно поднять (например, 60/40) и вернуть.
4. **Чек-пойнты.** `PreCompact` → `.claude/checkpoints/last.md`; ручной `/checkpoint`; межсессионно — `/gsd-pause-work` (`.planning/HANDOFF.json`, `.continue-here.md`) и `/gsd-resume-work`. Каталог `.claude/checkpoints/` добавить в `.gitignore` — это эфемерное состояние, не результат работы.
5. **Сжатие.** Автосжатие Claude Code + ручной `/compact <инструкция фокуса>` (`custom_instructions` доступны PreCompact только для `manual`).

**Измерение «до/после» для скриншота usage.** «До» снять в самом начале, до любых изменений среды вехи (сейчас: `/context` на старте и расход после стандартного сценария). «После» — на той же конфигурации сценария после п.1–4. Сценарий зафиксировать письменно, иначе сравнение недоказательно. Что видно в «после»: меньше токенов на старте (п.1–2), срабатывание WARNING (п.3), восстановление после сжатия без пересказа от человека (п.4–5).

## Recommended Project Structure

```text
.claude/
├── settings.json              # git: permissions + hooks проекта (+ SessionStart, PreCompact)
├── settings.local.json        # НЕ git: hooks GSD (+ statusLine на gsd-statusline.js)
├── hooks/
│   ├── protect-files.ts       # есть
│   ├── format-and-lint.ts     # есть
│   ├── reviewer-readonly.ts   # есть
│   ├── session-start.ts       # новый: дайджест (чистая функция + ввод-вывод)
│   ├── pre-compact.ts         # новый: запись checkpoint, всегда exit 0
│   ├── checkpoint.ts          # новый общий модуль для pre-compact и /checkpoint
│   ├── lib/hook-input.ts      # + схема событий без tool_name
│   └── gsd-*                  # НЕ git (GSD)
├── skills/
│   ├── review-step/ write-tests/   # есть
│   └── check/ session-end/ checkpoint/   # новые, disable-model-invocation
└── checkpoints/last.md        # НЕ git (.gitignore)
.planning/                     # git; ROADMAP, STATE, phases/ — пишет GSD
docs/
├── plan.md                    # тонкий указатель
├── memory.md                  # журнал
├── architecture.md            # новый
├── security-checklist.md      # новый
└── homework-2.md              # текст ДЗ (неизменяемый)
tests/unit/                    # + session-start.test.ts, pre-compact.test.ts
```

Структура опирается на существующие соглашения (`AGENTS.md`: hooks — `.claude/hooks`, тесты — `tests/unit/<модуль>.test.ts`, имена тестов на английском).

## Architectural Patterns

### Pattern 1: Запись в файл + чтение на следующем событии (мост через PreCompact)
**What:** событие, которое не умеет вставлять контекст, пишет файл; событие, которое умеет (`SessionStart` с `compact`), его читает.
**When to use:** любое состояние, нужное «после сжатия».
**Trade-offs:** есть окно гонки при параллельных сессиях в одном каталоге (последняя запись выигрывает); приемлемо для одного пользователя.

```typescript
// Чистая функция: тестируется без файловой системы
export function buildDigest(input: {
  source: 'startup' | 'resume' | 'clear' | 'compact' | 'fork';
  branch: string;
  dirty: boolean;
  stateHead: string | null;
  lastMemoryEntry: string | null;
  checkpoint: string | null;
}): string {
  /* собрать <= 2 КБ; checkpoint включать только при source === 'compact' */
}
```

### Pattern 2: Информационный hook — fail-open, защитный — fail-closed
**What:** `session-start`/`pre-compact` никогда не блокируют (при ошибке — тишина, exit 0); `protect-files` блокирует при ошибке разбора (уже так).
**When to use:** различать при добавлении каждого hook'а.
**Trade-offs:** тихие сбои информационных hooks надо ловить тестами и ручной проверкой (`claude --debug`/журнал hooks, вывод «completed with status»).

### Pattern 3: SSOT с ссылками вместо копий
**What:** каждый документ владеет одним видом фактов и ссылается на остальные по пути/ID.
**When to use:** все пары «plan ↔ ROADMAP», «memory ↔ STATE», «checklist ↔ SECURITY».
**Trade-offs:** читателю нужен переход по ссылке; зато нет рассинхронизации. README даёт таблицу «пункт ДЗ → артефакт → доказательство».

## Data Flow

### Поток планирования

```text
docs/homework-2.md ─► /gsd-new-project (уже: PROJECT.md) ─► ROADMAP.md (+REQUIREMENTS.md)
   ─► /gsd-plan-phase ─► phases/NN/PLAN.md ─► /gsd-execute-phase ─► SUMMARY.md
   ─► /gsd-verify-work ─► VERIFICATION.md ─► STATE.md (позиция), ROADMAP (чекбокс)
```

Ручные правки — через `Edit`, не `Write`; коммиты `.planning/` — см. «Конфликты процесса».

### Поток сессии (память и состояние)

```text
старт: SessionStart ─► наш дайджест + (claude-mem) свои воспоминания
работа: инструменты ─► claude-mem наблюдает; GSD обновляет STATE.md по шагам
конец:  /session-end ─► docs/memory.md (запись сверху) ; /gsd-pause-work (если не закончена фаза)
следующая сессия: дайджест берёт позицию из STATE.md и «Дальше» из memory.md
```

### Поток проверки (что видит проверяющий)

```text
README «Модуль 2» ─► таблица: пункт ДЗ → файл в git → доказательство
  1 GSD       → .planning/ROADMAP.md, STATE.md, docs/architecture.md, docs/security-checklist.md
  2 память    → docs/screenshots/memory-*.png, раздел в README
  3 hooks/cmd → .claude/settings.json, .claude/hooks/*.ts, .claude/skills/*, tests/unit/*
  4 контекст  → скриншоты usage до/после, .claude/checkpoints описан в README
  5 Discovery → .planning/ артефакты по «продление и пени»
```

## Масштаб: что растёт и чем это грозит

| Что растёт | Сейчас | Признак проблемы | Мера |
|-----------|--------|------------------|------|
| `docs/memory.md` | 38 КБ, новые сверху | дайджест или агент читает файл целиком | читать только верхнюю запись; позже — архив старых записей в `docs/memory-archive/` |
| `.planning/` | карта кода + PROJECT + config | шум в PR | решить политику `commit_docs` (ниже), `/gsd-pr-branch` умеет отфильтровать `.planning/` |
| Поверхность навыков | профиль `full` | большой стартовый контекст | `/gsd-surface` |
| Латентность hooks | tsx ≈150 мс × параллельно | заметные паузы на каждом Bash | замерять до/после (пункт открыт в `docs/memory.md`) |

## Anti-Patterns

### Anti-Pattern 1: `@import` ROADMAP/STATE в `CLAUDE.md`
**What people do:** подключают `.planning/STATE.md` в `CLAUDE.md`, чтобы «агент всегда знал позицию».
**Why it's wrong:** файл меняется скриптами внутри сессии, импорт устаревает; каждый токен платится каждую сессию.
**Do this instead:** дайджест `SessionStart` (свежий срез при старте и после сжатия).

### Anti-Pattern 2: Свои правки `STATE.md` из hooks или агентом
**What people do:** пишут «Дальше» прямо в `STATE.md` или из `pre-compact.ts`.
**Why it's wrong:** схема frontmatter генерируется GSD; `gsd-write-guard` блокирует резкое сжатие файла; monitor сам пишет `Stopped at` при CRITICAL — двойная запись.
**Do this instead:** читать `STATE.md`, писать только через команды GSD.

### Anti-Pattern 3: Копирование GSD-hooks в `settings.json`
**What people do:** переносят hooks из `settings.local.json`, чтобы они были «в git».
**Why it's wrong:** файлы `gsd-*` в git не лежат, на чистом клоне hook ссылается в пустоту; при переустановке получится рассинхрон.
**Do this instead:** в git лежат только наши hooks; про GSD — строка в README (`npx @opengsd/gsd-core@1.18.0 --claude --local`) и пометка «локально» в чек-листе.

### Anti-Pattern 4: `docs/memory.md` как выгрузка `claude-mem`
**What people do:** дублируют автоматические наблюдения в журнал.
**Why it's wrong:** журнал разрастается, теряется «ловушки/решение», проверяющий читает шум.
**Do this instead:** в журнал — только курируемое по формату; `claude-mem` остаётся фоном.

### Anti-Pattern 5: `PreCompact`, который может завершиться кодом 2
**What people do:** используют общий `exitWithFeedback` из `hook-input.ts`.
**Why it's wrong:** exit 2 блокирует сжатие; при ошибке чтения STATE сессия зависает у предела контекста.
**Do this instead:** `try { … } catch {}` и `process.exit(0)` в любом случае.

### Anti-Pattern 6: Два генератора одного документа
**What people do:** запускают `/gsd-docs-update` поверх ручного `docs/architecture.md` или `/gsd-map-codebase` поверх правок в `.planning/codebase/`.
**Why it's wrong:** перезапись; карта кода — сгенерированный артефакт.
**Do this instead:** ручные документы — в `docs/`, генерируемые — в `.planning/codebase/`; обновлять карту командой, не руками.

## Конфликты процесса (требуют решения автора)

| Конфликт | Где | Рекомендация |
|----------|-----|--------------|
| Сообщения коммитов GSD (`docs(phase-03): create … plans`) на английском; `AGENTS.md`: описание и тело на русском | `commit_docs: true` в `.planning/config.json`, воркфлоу GSD | Для этой вехи `commit_docs: false` и коммитить `.planning/` вручную по правилам `AGENTS.md`; к вехе с кодом (executor коммитит атомарно) вернуться отдельным решением. |
| `claude_md_path: ./.claude/CLAUDE.md` в `config.json` | генераторы профиля GSD | Claude Code читает и этот файл — получился бы второй файл инструкций рядом с корневым `CLAUDE.md`. Не запускать генерацию профиля; при необходимости сменить на корневой `CLAUDE.md` или обнулить. |
| `git.create_tag: true` | `config.json` | В памяти намечалось `false`: теги GSD на границах вех добавят шум рядом с `hw1-submitted`. Решить явно. |
| `gsd-validate-commit` (при `hooks.community: true`) | GSD | Проверяет форму `<тип>(<scope>): …` и ≤72 символов; русский текст пропускает. Не включать из-за побочных hooks; ограничение 72 символа держать самим. |
| Новая запись правил в `AGENTS.md` | см. SSOT | Любая правка `AGENTS.md`, `settings.json`, hooks — отдельный подтверждённый шаг (правило проекта). |

## Integration Points

### External Services

| Сервис | Способ | Заметки |
|--------|--------|---------|
| `claude-mem` worker (127.0.0.1) | плагин, свои hooks | Данные в `~/.claude-mem/`; облачный провайдер по умолчанию — отключить; нужны Bun/uv |
| npm registry | `gsd-check-update.js` на SessionStart | Фоновая проверка версии; может молча не работать через прокси |
| Playwright MCP | `.mcp.json` | Расходует контекст схемами инструментов; в замере «до/после» учитывать |
| GitHub | `gh pr create/merge` в `ask` | PR вехи: `.planning/` решено хранить в git (PROJECT.md) |

### Internal Boundaries

| Граница | Связь | Заметки |
|---------|-------|---------|
| `session-start.ts` ↔ `.planning/STATE.md` | чтение файла | не парсить схему целиком: первые N строк блока Current Position |
| `session-start.ts` ↔ `docs/memory.md` | чтение файла | первая секция `## …` до следующей |
| `pre-compact.ts` / `/checkpoint` ↔ git | `git status`, `git log` | без записи в репозиторий; ошибки git → пустой раздел |
| наши hooks ↔ hooks GSD | через stdin Claude Code, параллельно | общих файлов нет; не читать `/tmp/claude-ctx-*` |
| GSD ↔ `AGENTS.md` | только чтение агентами | GSD не должен переопределять правила проекта |
| `.planning/` ↔ Prettier/ESLint | исключены | сохранить исключение |

## Порядок сборки (для структуры фаз роадмапа)

Зависимости: базовые скриншоты «до» должны предшествовать любым изменениям среды; память требует двух сессий и сетевой установки (самый рискованный по окружению шаг) — раньше; hooks, быстрые команды и контекст делят один механизм checkpoint — вместе; `architecture.md` описывает построенное — позже всего; Discovery зависит только от GSD.

1. **Планирование и базовая линия.** Снять «до» (`/context`, usage, сценарий). Создать `ROADMAP.md`/`REQUIREMENTS.md` из `docs/homework-2.md` и `PROJECT.md`; сократить `docs/plan.md`; согласовать правки `AGENTS.md`; решить `commit_docs`, `claude_md_path`, `create_tag`. Закрывает пункт 1 ДЗ (roadmap, plan, progress).
2. **Память.** Установка и проверка `claude-mem` (локальный режим), опорные записи в `docs/security-checklist.md` по этой поверхности, проверка в двух сессиях; запасной путь — встроенная auto memory + `docs/memory.md`. Закрывает пункт 2.
3. **Hooks, быстрые команды, управление контекстом.** Схема событий в `hook-input.ts` + тесты; `session-start.ts`, `pre-compact.ts`, `checkpoint.ts`; skills `/check`, `/session-end`, `/checkpoint`; `statusLine` и пороги; профиль `/gsd-surface`; замер латентности; «после». Закрывает пункты 3–4.
4. **Discovery «продление и пени».** Через GSD (`/gsd-explore`, затем `/gsd-spec-phase` или `/gsd-discuss-phase` по backlog-элементу), результат — артефакты в `.planning/` и пункты backlog в `ROADMAP.md`; кода нет. Отметить: продление и пени затронут формат хранилища (`STORAGE_VERSION`) — правило «без миграции формат не менять» войдёт во вход Discovery. Закрывает пункт 5. Может выполняться независимо от фазы 2–3.
5. **Документы и сдача.** `docs/architecture.md` (пайплайн), `docs/security-checklist.md` (итоговые статусы), README «Модуль 2» с таблицей пункт ДЗ → артефакт → доказательство, `npm run check`, PR.

Для `coarse`-гранулярности (`config.json`) это 5 фаз; фазу 3 при необходимости делить на «hooks + команды» и «контекст».

### Что требует отдельного исследования в фазах

- Фаза 2: фактические побочные эффекты установки `claude-mem` в WSL (Bun/uv, прокси, провайдер, теги приватности), способ отключения.
- Фаза 3: поведение `gsd-statusline` при ручной регистрации; точный размер лимита вставки `additionalContext`; формат вывода `/context` для скриншота.
- Фаза 4: какая команда GSD лучше подходит для Discovery следующей вехи без смены текущей (`new-milestone` предполагает закрытую веху).

## Sources

- Локальные файлы (HIGH): `.claude/settings.json`, `.claude/settings.local.json`, `.claude/hooks/*.ts`, `.claude/hooks/gsd-*` (заголовки и логика), `.planning/config.json`, `.planning/PROJECT.md`, `.planning/codebase/{ARCHITECTURE,CONCERNS}.md`, `.claude/gsd-core/templates/{state,SECURITY}.md`, `.claude/gsd-core/references/git-planning-commit.md`, `.claude/gsd-core/workflows/{docs-update,pause-work}.md`, `docs/plan.md`, `docs/memory.md`, `AGENTS.md`, `.gitignore`.
- Claude Code hooks reference — https://code.claude.com/docs/en/hooks — `SessionStart` (matcher, `additionalContext`), `PreCompact`/`PostCompact` (вход, блокировка, отбрасывание `systemMessage`), объединение hooks из нескольких файлов, параллельный запуск (HIGH; страницу прочитано по частям).
- claude-mem, установка — https://docs.claude-mem.ai/installation ; архитектура hooks — https://docs.claude-mem.ai/architecture/hooks.md (MEDIUM: вторичные сведения о порте и приватности расходятся или отсутствуют).
- Замер латентности — локальный прогон `gsd-secret-read-guard`, `gsd-workflow-guard`, `gsd-context-monitor` (≈25 мс), `protect-files` через `tsx` (≈156 мс) на тестовом вводе (LOW–MEDIUM: один запуск, холодный/тёплый кэш не разделены).

---
*Architecture research for: агентно-ориентированный пайплайн (ДЗ-2 OTUS)*
*Researched: 2026-10-22*
