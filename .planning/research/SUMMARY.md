# Итоговое исследование: Библиотека — среда агента (ДЗ-2)

**Project:** Библиотека — учебный полигон OTUS «ИИ-агенты»
**Domain:** агентно-ориентированный пайплайн разработки вокруг Claude Code (память между сессиями, быстрые команды и auto hooks, управление контекстом, документы планирования GSD)
**Researched:** 2026-10-22
**Confidence:** MEDIUM (встроенные механизмы Claude Code — HIGH; claude-mem — MEDIUM/LOW; ожидания проверяющего — MEDIUM)

Приложение (domain / server / client) в этой вехе не меняется. Исследование касается только среды агента и документов планирования.

## Executive Summary

Вехи ДЗ-2 — это не новые фичи приложения, а настройка среды, которую проверяющий должен увидеть в git и воспроизвести по README. Критерий сдачи один: каждый из шести пунктов ДЗ имеет артефакт в git, доказательство (команда или скриншот) и строку в README «Модуль 2».

Рекомендованный подход — «встроенное первым, внешнее вторым». Встроенные механизмы Claude Code (`SessionStart` / `PreCompact` / `PostCompact` hooks, `autoCompactWindow`, `/compact`, `/context`, `/usage`, `/rewind`, skills) закрывают большую часть задач. Внешний плагин `claude-mem` ставится на уровне пользователя, с закреплённой версией и локальным провайдером сжатия; при сбоях работает запасной вариант «аналог» из ДЗ: `docs/memory.md` плюс `SessionStart`-дайджест. Новые npm-зависимости не добавляем: hooks — на TypeScript через уже стоящий `tsx` или на чистом Node там, где нужна работа без `node_modules`. Файлы GSD остаются вне git.

Главные риски: (1) память фиксирует секреты и ПДн дословно (контакты читателей в `data/library.json`, вывод `.env`), а обходы запретов чтения `.env` уже найдены в `CONCERNS.md`; (2) hooks и worker памяти ломаются из-за окружения (прокси, nvm, отсутствие `node_modules`), и поломка может быть тихой; (3) `PreCompact` с кодом выхода 2 блокирует сжатие, а контекст из `PreCompact` в сессию не попадает. Решения: память сначала проверяется канарейкой, hooks информационные и всегда завершаются с кодом 0, возврат контекста после сжатия — через `SessionStart` с `matcher: compact`. Также закрыть находки `CONCERNS.md` до установки памяти и не допустить расхождения GSD и `docs/plan.md`.

## Key Findings

### Recommended Stack

- **Встроенная auto memory Claude Code** — уже работает; не отключать.
- **claude-mem 15.0.1** (`npx claude-mem@15.0.1 install --provider claude`) — эпизодическая память (SQLite + Chroma, данные в `~/.claude-mem/`, вне репозитория). Версию закрепить; `npm install -g claude-mem` не использовать; `CMEM Pro` (шлюз cmem.ai) не выбирать.
- **`docs/memory.md`** — курируемый журнал в git; он же запасной вариант памяти.
- **Hooks в `.claude/settings.json`** (`SessionStart`, `PreCompact`, `PostCompact`) — единственное место hooks, которое видит проверяющий.
- **Skills** (`.claude/skills/<имя>/SKILL.md`) — проектные быстрые команды; `disable-model-invocation: true` для команд с побочными эффектами.
- **`autoCompactWindow`** (например, 200000) в `settings.json` — воспроизводимый порог (допустимо 100K–1M; см. расхождение 5).
- **statusLine** на `gsd-statusline.js` — оживляет `gsd-context-monitor` (без него WARNING 35% / CRITICAL 25% не приходят). Прописывается в `settings.local.json`.
- **`tsx` 4.23.x** (уже devDependency) — hooks на TypeScript; для информационных hooks без `node_modules` допустим чистый Node.
- **GSD Core 1.18.0** — `/gsd-pause-work` / `/gsd-resume-work`, `/gsd-progress`, `/gsd-explore`, `/gsd-spec-phase`, `/gsd-discuss-phase`; уже установлен.

Окружение (проверено): Claude Code 2.1.308; Node 24.22.1 (nvm); claude-mem требует Claude Code ≥ 2.1.139, Node ≥ 20.12, Bun ≥ 1.1.31; `jq` отсутствует — скрипты на Node/TypeScript; `uv` в `~/.local/bin`.

### Expected Features

Фича сделана, если есть: артефакт в git, доказательство работы, строка в README «Модуль 2».

**Must have (table stakes):**

- **Пункт 1, GSD:** `ROADMAP.md` с фазами = шагами ДЗ-2 и Success Criteria; `REQUIREMENTS.md`; `STATE.md` и вывод `/gsd-progress`; минимум один реальный `PLAN.md`; выжимка architecture (ссылка на `.planning/codebase/ARCHITECTURE.md`); `docs/security-checklist.md` (8–12 пунктов из `CONCERNS.md` и ДЗ-1 с командой проверки); `docs/plan.md` — указатель.
- **Пункт 2, память:** установлена, hooks зарегистрированы, worker жив (`npx claude-mem doctor`, `/hooks`); доказательство «сессия A → сессия B» (факт, которого нет ни в одном файле репозитория); README с версией, командами и данными; осознанный выбор провайдера.
- **Пункт 3, команды и hooks:** 3–5 быстрых команд (`/lib-check`, `/lib-status`, запись в `docs/memory.md`); `SessionStart` (ветка, позиция GSD, верхняя запись `docs/memory.md`; ≤ 10 000 символов, желательно ≤ 2–3 КБ); `PreCompact` (чекпойнт, всегда exit 0); `SessionStart` с `matcher: compact` возвращает чекпойнт; тесты Vitest в `tests/unit/`; доказательство через `/hooks` и файл чекпойнта после `/compact`.
- **Пункт 4, контекст:** письменная политика контекста (когда `/compact`, когда `/clear`, что сохранять) в `AGENTS.md` или README; чекпойнт и восстановление; скриншоты `/context` и `/usage` ДО и ПОСЛЕ с подписями (модель, окно, что включено); проверка, что после сжатия агент знает фазу, ветку и шаг.
- **Пункт 5, Discovery:** `/gsd-explore` → `NN-SPEC.md` (`/gsd-spec-phase`, ambiguity ≤ 0.20, Interview Log) → `NN-CONTEXT.md` (`/gsd-discuss-phase`, Deferred Ideas); без кода; в README — пять строк «решили / отложили».
- **Пункт 6, сдача:** README «Модуль 2» с таблицей «пункт → артефакт → команда → скриншот»; `npm run check` зелёный; PR из `feat/module-2` в `main` с описанием на русском без атрибуции.

**Should have:** сравнение сценария «с политикой» и «без» в числах; Edge Coverage в SPEC.md; spike по хранению истории продлений (если нужно); `/gsd-health`, `/gsd-stats`; `/review-step` перед PR.

**Defer:** реализация продления и пеней (следующая веха; `STORAGE_VERSION` потребует миграции); исправление находок `CONCERNS.md` (фиксировать в security-checklist как «открыто»); `/gsd-new-milestone` до завершения вехи; `hooks.community: true`; `/gsd-autonomous`; `--auto` в Discovery; `/gsd-docs-update`.

**Anti-features:** править `ROADMAP.md`/`STATE.md` руками; копировать hooks GSD в `settings.json`; `--dangerously-skip-permissions`; `PreCompact` с блокировкой; 15 быстрых команд; вторая система памяти (MemPalace рядом с claude-mem); выгрузка наблюдений claude-mem в `docs/memory.md`; скриншоты usage из разных задач; выдавать стоимость из `/usage` за реальные расходы на подписке.

### Architecture Approach

Принцип «один источник на один вид факта»: план и статусы — `ROADMAP.md` + `STATE.md`; решения — `PROJECT.md` (Key Decisions); правила — `AGENTS.md`; журнал сессий — `docs/memory.md`; наблюдения claude-mem — никогда не источник правды. `docs/plan.md` сокращается до указателя; `CLAUDE.md` импортирует только его; `STATE.md` и `ROADMAP.md` в `@import` не добавлять.

**Major components:**

1. Слой инструкций — `CLAUDE.md` → `AGENTS.md`; `.claude/rules/*.md` с `paths:`; skills; `reviewer`.
2. Слой планирования GSD — `PROJECT.md`, `ROADMAP.md`, `STATE.md`, `config.json`, `phases/`, `codebase/`, `research/`.
3. Слой документов для проверяющего — README, `docs/architecture.md` (пишется вручную после построенного), `docs/security-checklist.md`, `docs/memory.md`.
4. Память — claude-mem (вне git), auto memory, `docs/memory.md`, `STATE.md`.
5. Автоматика — проектные hooks в `settings.json` (`protect-files`, `format-and-lint`, `session-start`, `pre-compact`); GSD-hooks в `settings.local.json` (вне git, ~18 штук).
6. Контекст — `statusLine`, `PreCompact` → чекпойнт, `SessionStart(compact)` → дайджест, `/gsd-pause-work`.

**Поток сжатия:** `PreCompact` (matcher `manual|auto`) пишет чекпойнт в игнорируемый файл, всегда `exit 0` → сжатие → `SessionStart` с `source=compact` читает чекпойнт и позицию GSD и вставляет дайджест (≤ 2 КБ) через `additionalContext`. Контекст из `PreCompact` в сессию не попадает. `PostCompact` получает `compact_summary` — можно сохранить как материал для скриншота.

**Границы владения:** `settings.json` (git) — только наши hooks и permissions; `settings.local.json` — установщик GSD плюс `statusLine`; наши hooks не пишут `STATE.md`; hooks не читают `/tmp/claude-ctx-*` и не вызывают `git add` / `git commit`.

**Правила hooks:** `SessionStart` — использовать, информационный, fail-open; не включать `hooks.community` (дублирует инъекцию и включает `gsd-validate-commit.sh`). `PreCompact` — чекпойнт, всегда `exit 0`. `PostCompact` — опционально. `Stop`, `UserPromptSubmit` — не добавлять (каждый ход; `Stop` рискует зациклиться). `SessionEnd` — не использовать (бюджет 1.5 с). Не добавлять `"onFailure": "block"` для `SessionStart`/`PreCompact`. Лимит вывода SessionStart — 10 000 символов; при превышении Claude получает превью 2 000 символов.

### Critical Pitfalls

1. **Секреты и ПДн в памяти.** claude-mem сохраняет вывод инструментов в SQLite; `data/library.json` содержит контакты читателей; обходы чтения `.env` (`cat ./.env`, `grep x .env`, относительные пути в `reviewer`) уже найдены в `CONCERNS.md`. Профилактика: до установки закрыть обходы (`Read(**/.env*)`, basename-проверка в `reviewer-readonly.ts`, тесты в `protect-files.test.ts`); не печатать `data/library.json` целиком; канарейка-тест (фальшивый ключ в выводе, затем поиск по `~/.claude-mem/claude-mem.db` — пусто); `CLAUDE_MEM_ONLINE_OPTIN=false`, без Cloud Sync; при утечке — запасной вариант.
2. **Worker и окружение ломают память тихо.** Bun, `uv`, порт, PID-файлы, прокси (`ECONNRESET`), nvm (launcher не на PATH в hooks), WSL. Профилактика: `env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY npx claude-mem@15.0.1 install --provider claude`; `NO_PROXY=127.0.0.1,localhost`; новая сессия после установки; `npx claude-mem doctor`; рецепт `repair` в README; критерий отката — после одной попытки починки.
3. **Конфликт и задержка hooks.** В `settings.local.json` GSD уже ~18 hooks; каждый `tsx`-hook — холодный процесс (~150 мс против ~25 мс у GSD на Node). Профилактика: инвентаризация `/hooks` в `docs/`; быстрые hooks; узкие матчеры (`startup|resume|compact`); `timeout` 5–10 с; замер `time`; без сети в SessionStart.
4. **PreCompact и потерянный чекпойнт.** Вывод `PreCompact` в контекст не попадает; exit 2 блокирует сжатие; чекпойнт только «в памяти» не переживает сжатие. Профилактика: PreCompact пишет файл → SessionStart(compact) читает; тестировать и ручной `/compact`, и автосжатие.
5. **Path-scoped rules теряются после сжатия.** `.claude/rules/domain.md` (`paths: src/domain/**`) и `e2e.md` не переживают сжатие. Продублировать критичное в `AGENTS.md` или снять `paths:` у важных правил — с согласия автора. Проверка: правка в `src/domain/` после `/compact`.
6. **Discovery уходит в реализацию или затирает ROADMAP.** `/gsd-new-milestone` до завершения вехи перепишет `PROJECT.md`; `/gsd-autonomous`, `/gsd-execute-phase`, `/gsd-quick` могут начать писать код в `src/domain/`. Профилактика: только `/gsd-explore` + `/gsd-spec-phase` / `/gsd-discuss-phase`; `mode: interactive`; `auto_advance: false`; `git diff --stat main -- src tests` пуст.
7. **Шум в git и PR.** `commit_docs: true` даст десятки коммитов `.planning/**` с английскими сообщениями. См. расхождение 3.
8. **Второй файл инструкций и генерируемые файлы.** `config.json`: `claude_md_path: ./.claude/CLAUDE.md`; `.claude/CLAUDE.md` не в `.gitignore`; `--force` перезаписывает рукописное. Профилактика: не запускать генерацию профиля; без `--force`; после операций GSD — `git status`, `git diff`, `npm run check`. Не запускать `/gsd-docs-update`, `/gsd-ingest-docs`.
9. **Дубли планов.** `@docs/plan.md` в `CLAUDE.md`; `AGENTS.md` велит отмечать прогресс в `docs/plan.md`; `PROJECT.md` — источник `ROADMAP.md`. Правка `AGENTS.md` — только с согласием автора. Проверка: `grep -rn "docs/plan.md" AGENTS.md CLAUDE.md docs .planning`.
10. **Агент подменяет защиты.** `acceptEdits` позволяет править `.claude/settings.json`, `.claude/hooks/*.ts`, `.claude/agents/*`. `settings.local.json` шире (`Bash(git commit *)`, `Bash(pkill *)`). Профилактика: `Edit(./.claude/**)` в `ask` до правок hooks; сузить allow; оставить `gsd-prompt-guard` и `gsd-read-injection-scanner`.
11. **Fail-open защитных hooks.** Без `node_modules` `tsx`-hooks молча не работают. GSD-hooks захардкодили путь к Node 24; без nvm `command -v node` даёт Node 22. Профилактика: новые hooks предупреждают при отсутствии `node_modules` или неверной версии Node; после `gsd-update` проверять `settings.local.json`.

## Implications for Roadmap

Предлагаемая структура фаз (согласована с порядком сборки из ARCHITECTURE и Ф1–Ф6 из PITFALLS; размещение Discovery — см. расхождение 2). Каждый шаг подтверждает автор.

### Фаза 1: Базовая линия, GSD-инициализация, гигиена безопасности

**Rationale:** «до»-скриншоты — до любых изменений среды; находки `CONCERNS.md` по секретам — до памяти; политика коммитов и `claude_md_path` — до первого авто-коммита GSD.
**Delivers:** снимок «до» (`/context`, `/usage`, сценарий); `ROADMAP.md` и `REQUIREMENTS.md`; `docs/plan.md` — указатель (с согласованной правкой `AGENTS.md`); `docs/security-checklist.md` (черновик); закрыты обходы `.env` и `Edit(./.claude/**)` в `ask`; решения по `commit_docs`, `claude_md_path`, `create_tag` записаны в `PROJECT.md`; `npm run check` зелёный.
**Addresses:** пункт 1 ДЗ; единый источник плана.
**Avoids:** Pitfalls 1 (частично), 8, 10, 11, 12, 13, 14.

### Фаза 2: Память агента между сессиями

**Rationale:** самый рискованный по окружению шаг; нужны две сессии для проверки; установка вне проекта требует согласия.
**Delivers:** claude-mem 15.0.1, `--provider claude`, телеметрия и облако выключены; канарейка пройдена; доказательство «сессия A → сессия B» (`hw2-memory-session-a.png` / `-b.png`); раздел README (версия, `env -u`, `doctor`, `repair`, пути данных); запись в `docs/memory.md`; строки в `docs/security-checklist.md`. Запасной вариант: `docs/memory.md` + `SessionStart`-дайджест.
**Avoids:** Pitfalls 1, 2, 3, 18, 22, 25.

### Фаза 3: Быстрые команды и auto hooks

**Rationale:** hooks и команды делят механизм чекпойнта; проектировать вместе; зависит от инвентаризации GSD-hooks и решения по runtime.
**Delivers:** `hook-input.ts` (схема событий без `tool_name`); `session-start.ts` (ветка, позиция GSD, верхняя запись `docs/memory.md`, чекпойнт при `compact`, предупреждение без `node_modules`); `pre-compact.ts` (всегда exit 0, игнорируемый путь); общий модуль чекпойнта; 3–5 skills с `disable-model-invocation`; тесты `tests/unit/session-start.test.ts`, `pre-compact.test.ts`; `.gitignore` и `.prettierignore` в той же правке; таблица «событие → hook → что делает → как проверить» в README; `/hooks` и вывод SessionStart в новой сессии.
**Avoids:** Pitfalls 4, 5, 6, 9, 15, 17, 23.

### Фаза 4: Управление контекстом и скриншоты «до/после»

**Rationale:** «после» возможно только после фаз 1–3 на той же нагрузке; statusLine нужен, чтобы монитор GSD работал.
**Delivers:** `autoCompactWindow` (или `/autocompact`) с обоснованием; `statusLine` на `gsd-statusline.js` в `settings.local.json`, проверка `/tmp/claude-ctx-*.json`; пороги GSD (при демонстрации временно повышены); политика контекста в `AGENTS.md` или README (≤ 200 строк); сценарий «правка в `src/domain/` → `/compact` → правка без чтения соседних файлов»; `hw2-usage-before.png`, `hw2-usage-after.png`, `hw2-after-compact-resume.png` с подписями; ответ агента после сжатия.
**Avoids:** Pitfalls 5, 7, 8, 19.

### Фаза 5: Discovery «продление и пени» (без кода)

**Rationale:** зависит только от GSD и фазы в ROADMAP; может идти параллельно с фазами 2–4; `src/` и `tests/` не меняются.
**Delivers:** `/gsd-explore` (заметка, `.planning/research/questions.md`, seed или backlog); `NN-SPEC.md` (ambiguity ≤ 0.20, 2–3 раунда интервью, Edge Coverage, Prohibitions); `NN-CONTEXT.md` (Deferred Ideas); открытые вопросы: срок и число продлений, пеня (ставка, потолок, единица, округление, блокировка выдачи), миграция `STORAGE_VERSION`, `now: Date`; пункты backlog в `ROADMAP.md`; `hw2-discovery-explore.png`, `hw2-discovery-spec-score.png`; пять строк в README.
**Avoids:** Pitfall 16.

### Фаза 6: Документы, README и сдача

**Rationale:** описывают построенное — идут последними.
**Delivers:** `docs/architecture.md` (вручную, не через `/gsd-docs-update`); итоговый `docs/security-checklist.md` с колонкой «воспроизводим из git»; README «Модуль 2» с таблицей «пункт → артефакт → команда → скриншот», разделом «Что не воспроизводится из git», картой проверки; `git log` на язык и атрибуцию; `npm run check` зелёный; PR из `feat/module-2` (русский, без `Co-Authored-By` и «Generated with Claude Code»); тег `hw2-submitted` — по решению автора.
**Avoids:** Pitfalls 3, 10, 13, 19.

### Phase Ordering Rationale

- Снимок «до» — раньше любых изменений среды.
- Гигиена секретов (Ф1) — раньше памяти (Ф2).
- Память (Ф2) — раньше hooks и контекста; при провале — запасной вариант, фазы 3–4 не блокируются.
- Hooks, команды и контекст (Ф3–Ф4) — вместе (общий чекпойнт, один скриншот «до/после»).
- Discovery (Ф5) независим; параллелен Ф2–Ф4, если не трогает `src/`.
- Документы и PR (Ф6) — последними.

### Research Flags

Нужен research перед планированием (`/gsd-plan-phase --research-phase <N>`):

- **Фаза 2:** побочные эффекты claude-mem в WSL (Bun/uv, прокси, порт, `--provider`, редакция, тег `<private>`); канарейка обязательна.
- **Фаза 3:** размер вставки `additionalContext`; задержки `tsx` против Node; формат `claude --debug`.
- **Фаза 4:** имя и поведение `autoCompactWindow` (расхождение 5); формат `/context` и `/usage`; вывод `gsd-statusline.js`.
- **Фаза 5:** команда GSD для Discovery внутри текущей вехи (без `new-milestone`); `text_en` для русскоязычных требований в `spec-phase`.

Стандартные паттерны (research не нужен): **Фаза 1** (команды GSD задокументированы локально, шаблон `SECURITY.md`); **Фаза 6** (README и PR по `AGENTS.md`).

## Расхождения исследований (решить автору)

| #   | Вопрос                                                                                                                                                                                     | Варианты                                                                                                             | Рекомендация                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | Каталог чекпойнтов: `.local/checkpoints/` (STACK) против `.claude/checkpoints/` (ARCHITECTURE); PITFALLS предлагает `.planning/` или `.local/`                                             | (а) `.local/checkpoints/` — уже в `.gitignore`; (б) `.claude/checkpoints/` — нужна правка `.gitignore`; (в) `.planning/` — но он коммитится | (а) — без новых правок `.gitignore`                                                                                           |
| 2   | Порядок фаз: Discovery в конце (ARCHITECTURE, фаза 4 из 5) против параллельной фазы (PITFALLS Ф5, ARCHITECTURE «независим от 2–3») против backlog `999.x` (FEATURES, вариант б) против после `new-milestone` | (а) фаза внутри вехи; (б) backlog + `/gsd-capture`; (в) после завершения вехи                                         | (а) — `spec-phase` / `discuss-phase` требуют фазу в ROADMAP; можно параллельно с Ф2–Ф4                                       |
| 3   | `commit_docs`: `true` (config, PROJECT: `.planning/` в git) против `false` (ARCHITECTURE для вехи)                                                                                         | (а) `false`, коммиты вручную по `AGENTS.md`; (б) `true` с проверкой `git log` на пробе; (в) `true` + `/gsd-pr-branch` | (а) на этой вехе                                                                                                              |
| 4   | `git.create_tag`: `true` (config) против `false` (ARCHITECTURE)                                                                                                                            | (а) `false`, ручной `hw2-submitted`; (б) оставить `true`                                                            | решает автор                                                                                                                  |
| 5   | Параметр автосжатия: `autoCompactWindow` подтверждён (STACK, HIGH) против «не подтверждён» (FEATURES, ARCHITECTURE — страница model-config не открылась)                                   | (а) использовать после проверки в `/help` установленной версии; (б) убрать, только `/compact` с фокусом              | (а) — проверить до фазы 4                                                                                                     |
| 6   | Runtime hooks: `tsx` (STACK, ARCHITECTURE) против чистого Node / bash (PITFALLS, ARCHITECTURE для проверки `node_modules`)                                                                | (а) `tsx` везде; (б) Node для информационных, `tsx` для защитных; (в) Node везде с тестами Vitest                    | (б)                                                                                                                           |
| 7   | Порт worker claude-mem: `37700 + (uid % 100)` = 37700 (STACK) против 37777 (PITFALLS, issues)                                                                                              | —                                                                                                                    | сверить в `~/.claude-mem/settings.json`, записать в README                                                                    |
| 8   | Имена skills: `/lib-status`, `/lib-check`, `/lib-handoff` (STACK) против `/check`, `/session-end`, `/checkpoint` (ARCHITECTURE)                                                            | (а) префикс `lib-`; (б) короткие имена                                                                               | `/checkpoint` НЕ использовать: встроенный алиас `/rewind`, проектный skill его переопределит (STACK прямо запрещает). Префикс `lib-` |
| 9   | Расположение statusLine: `settings.local.json` (STACK, ARCHITECTURE) против собственного `statusline.ts` в git (без bridge монитор GSD не заработает)                                     | (а) `settings.local.json` с описанием в README и скриншотом; (б) свой скрипт в git                                   | (а)                                                                                                                           |
| 10  | Приватность claude-mem: `<private>` документирован (PITFALLS, MEDIUM) против «не подтверждён» (FEATURES); `CLAUDE_MEM_ONLINE_OPTIN` упомянут только в PITFALLS                            | —                                                                                                                    | проверить в документации установленной версии до фазы 2                                                                       |
| 11  | `hooks.community` (`gsd-session-state.sh`): включать или нет                                                                                                                               | (а) нет, один инжектор; (б) да, дубль с нашим дайджестом                                                             | (а), решение записать в `docs/memory.md`                                                                                      |
| 12  | `docs/memory.md` в SessionStart: только верхняя запись (ARCHITECTURE) или весь файл                                                                                                        | —                                                                                                                    | только верхняя запись (файл 38 КБ и растёт)                                                                                   |

## Confidence Assessment

| Area         | Confidence                                                                                  | Notes                                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack        | MEDIUM                                                                                      | Встроенные механизмы — HIGH (официальная документация, версия 2.1.308 локально). claude-mem — MEDIUM: быстрые релизы 14→15, неполная документация.           |
| Features     | MEDIUM-HIGH                                                                                 | Содержание пунктов ДЗ — HIGH (локальные файлы). Ожидания проверяющего — MEDIUM (из короткого текста задания).                                                |
| Architecture | HIGH для состава файлов и семантики hooks; MEDIUM для claude-mem, `gsd-statusline`, `gsd-surface` (не запускались) | Latency — один прогон, без разделения холодного и тёплого кэша.                                                                                               |
| Pitfalls     | MEDIUM                                                                                      | Локальные файлы и `CONCERNS.md` — HIGH; поведение hooks и compaction — MEDIUM (одна выборка документации); claude-mem — MEDIUM/LOW (issues, один пост о редакции — LOW). |

**Overall confidence:** MEDIUM

### Gaps to Address

- **claude-mem в WSL:** побочные эффекты не проверены; закрывается на фазе 2 канарейкой и `doctor`; при провале — запасной вариант.
- **`autoCompactWindow` / `/autocompact`:** расходятся по подтверждению; проверить в установленной версии до фазы 4.
- **`additionalContext` в SessionStart:** лимит 10 000 подтверждён; поведение превью — MEDIUM; бюджет ≤ 2–3 КБ.
- **Вывод `gsd-statusline.js`:** прочитать до включения.
- **Латентность hooks:** замерить до и после фазы 3; записать в `docs/memory.md`.
- **Формат `/context` и `/usage` на подписке:** проверить на фазе 4.
- **Discovery:** решение по расхождению 2 нужно до фазы 5.
- **`Edit(./.claude/**)` в `ask`:** не проверено на практике; проверка на фазе 1.
- **Языковой конфликт GSD-коммитов:** валидатор эвристичен под английский; проверить пробным коммитом, если `commit_docs: true`.

## Sources

### Primary (HIGH)

- Локальные файлы: `.planning/PROJECT.md`, `.planning/config.json`, `.planning/codebase/CONCERNS.md`, `docs/homework-2.md`, `docs/plan.md`, `docs/memory.md`, `AGENTS.md`, `.claude/settings.json`, `.claude/settings.local.json`, `.claude/hooks/*`, `.gitignore`, `.prettierignore`.
- Локальные исходники GSD Core 1.18.0: `.claude/gsd-core/workflows/{explore,spec-phase,discuss-phase,new-milestone,pause-work,docs-update}.md`, `templates/SECURITY.md`, `templates/state.md`.
- Claude Code docs: code.claude.com/docs/en/hooks, hooks-guide, context-window, model-config (частично), checkpointing, memory, statusline, skills, commands, costs.
- Окружение: `claude --version` = 2.1.308; Node 24.22.1; `jq` отсутствует; `uv` в `~/.local/bin`.

### Secondary (MEDIUM)

- claude-mem: docs.claude-mem.ai/installation, docs.claude-mem.ai/architecture/hooks.md, docs.claude-mem.ai/usage/folder-context, github.com/thedotmack/claude-mem (README), npm `claude-mem` 15.0.1 (Apache-2.0).
- Issues claude-mem: #565 (bun не найден), #380 (порт 37777), #2899 (осиротевший worker; пересказ — LOW).

### Tertiary (LOW)

- Опыт тестирования редакции секретов claude-mem (один автор): pub.towardsai.net (is-claude-codes-claude-mem-saving-your-api-keys…) — требует проверки.
- Сторонний обзор: datacamp.com/tutorial/claude-mem-guide.
- Не использованы (альтернативы): `@modelcontextprotocol/server-memory` 2.0.0, PyPI `basic-memory` 0.23.2 (AGPL-3.0), PyPI `mempalace` 3.11.0, npm `ccusage` 20.0.40.

---

_Research completed: 2026-10-22_
_Ready for roadmap: yes (после решения расхождений 1–5, 8 из таблицы выше)_
