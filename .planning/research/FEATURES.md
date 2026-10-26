# Feature Research

**Domain:** агентно-ориентированный пайплайн разработки вокруг Claude Code (ДЗ-2 курса OTUS «ИИ-агенты»)
**Researched:** 2026-10-22
**Confidence:** MEDIUM-HIGH (внутреннее устройство GSD Discovery — HIGH, прочитано из `.claude/gsd-core/workflows/`; поведение hooks и `/usage` — HIGH, официальная документация Claude Code; claude-mem — MEDIUM, официальная страница установки плюс сторонние обзоры; ожидания проверяющего — MEDIUM, выведены из короткого текста `docs/homework-2.md`, а не из чек-листа курса)

## Как читать документ

«Фичи» здесь — это результаты ДЗ-2, а не функции библиотеки. Единственный критерий оценки в
`docs/homework-2.md`: «подготовлено окружение под конкретный проект, и в README описаны результаты
2-го модуля для проверки». Значит, каждая фича считается сделанной, когда у неё есть три вещи:
**артефакт в git** (воспроизводимо), **доказательство работы** (команда или скриншот) и
**строка в README «Модуль 2»** (проверяющий находит это за минуту). Это же — Core Value из `PROJECT.md`.

Сложность: LOW — до часа, MEDIUM — одна сессия с проверкой, HIGH — несколько сессий или есть внешний риск.

## Feature Landscape

### Пункт 1. GSD-проект инициирован (roadmap, plan, progress, architecture, security-checklist)

Что есть: `.planning/PROJECT.md`, `.planning/config.json`, `.planning/codebase/*` (7 файлов), GSD Core 1.18.0.
Чего нет: `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, планов фаз — их создаёт `/gsd-new-project` (шаги 7–8:
требования, затем roadmapper), а не ручная правка.

#### Table Stakes (проверяющий ожидает)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Roadmap — `.planning/ROADMAP.md` с фазами = шагами ДЗ-2, каждая со Success Criteria | Прямо названо в пункте 1 | LOW | Создаёт roadmapper; фазы — процесс, не фичи продукта (решение в `PROJECT.md`) |
| Plan — минимум один `PLAN.md` реальной фазы (`.planning/phases/NN-slug/NN-01-PLAN.md`) | «plan» в списке; roadmap ≠ plan | MEDIUM | Через `/gsd-plan-phase` для фазы, которая действительно исполняется (напр. README/PR), не для пустой фазы |
| Progress — `.planning/STATE.md` + вывод `/gsd-progress` | «progress» в списке | LOW | Скриншот `/gsd-progress` с отмеченными фазами; STATE.md обновляется скриптами, руками не править |
| Architecture — документ архитектуры, ссылка из README | «architecture» в списке | LOW | Источник уже есть: `.planning/codebase/ARCHITECTURE.md` (слои domain/server/client, зависимости внутрь). Нужна читаемая выжимка для человека, а не копия |
| Security-checklist — файл с чек-листом, привязанным к проекту | «security-checklist» в списке | MEDIUM | Основа — `CONCERNS.md` (обходы `./.env`, правка `settings.json` агентом, лимиты длин, дубли формы) + permissions/hooks из ДЗ-1. Формат — таблица «риск → контроль → как проверить → статус» |
| Единый источник плана: `docs/plan.md` ссылается на `.planning/ROADMAP.md`, дубль шагов удалён | Решение зафиксировано в `PROJECT.md`; два плана расходятся | LOW | Шаг 1в в `docs/plan.md` |
| `.planning/` закоммичен, файлы самого GSD — вне git | Проверяющий клонирует репозиторий и видит план | LOW | Уже сделано (`.gitignore`, Prettier ignore) |
| Установка воспроизводима: команда установки в README | «Установить gsd-core» | LOW | `npx @opengsd/gsd-core@1.18.0 --claude --local`, требование Node ≥ 24 — уже в `AGENTS.md` |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Security-checklist в формате GSD `SECURITY.md` (Trust Boundaries, Threat Register с STRIDE и severity, Accepted Risks, Sign-Off) | `workflow.security_enforcement: true` и `security_block_on: high` уже включены; `/gsd-secure-phase` умеет проверять закрытие угроз | MEDIUM | Шаблон: `.claude/gsd-core/templates/SECURITY.md`. Таблица угроз ссылается на строки `CONCERNS.md` |
| `/gsd-health` и `/gsd-stats` как доказательство целостности `.planning/` | Скриншот «здоровье планирования: OK» | LOW | Одна команда, сильное доказательство |
| Трассировка «требование ДЗ → REQ-ID → фаза → доказательство» в REQUIREMENTS.md | Проверяющий идёт по цепочке за минуту | LOW | REQ-ID выдаёт GSD; колонка «доказательство» — ссылка на скриншот/коммит |
| Тег GSD-вехи (`create_tag: true` в config) | Аналог `hw1-submitted` | LOW | Ставит `/gsd-complete-milestone`; в этом ДЗ можно поставить тег вручную после PR |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Править `ROADMAP.md`/`STATE.md` руками | Быстро | Файлы пишут скрипты GSD; ручные правки ломают парсинг и `/gsd-progress` | `/gsd-phase`, `/gsd-progress`; исключение — прозаические разделы документов |
| Второй документ архитектуры «для красоты» | Хочется диаграмму | Два источника расходятся — та же проблема, что решали с `plan.md` | Одна выжимка со ссылкой на `.planning/codebase/ARCHITECTURE.md` |
| Универсальный OWASP-чеклист на 50+ пунктов | Выглядит солидно | Не «под конкретный проект» — критерий оценки; пункты без проверки — шум | 8–12 пунктов из реальных находок CONCERNS.md и ДЗ-1 с командой проверки |
| Фазы roadmap = будущие фичи продукта (продление, пени, SQLite) | Хочется «настоящий» roadmap | Решение `PROJECT.md`: веха = процесс; фичи — следующая веха | Фичи — в backlog (`999.x`) и в Discovery |
| Коммитить `.claude/gsd-*`, `commands/gsd-*` | Чтобы проверяющий «видел GSD» | Сторонний код; уже выведен из git осознанно | README: команда установки + версия |
| Исправлять находки CONCERNS.md в этой вехе | Раз нашли — починим | Out of Scope в `PROJECT.md`; раздувает ДЗ | Записать в security-checklist как «открыто» с планом |

### Пункт 2. Память агента между сессиями (claude-mem или аналог)

Установка claude-mem: `npx claude-mem install` (рекомендуется официальной страницей) или
`/plugin marketplace add thedotmack/claude-mem` → `/plugin install claude-mem`. Требования: Node ≥ 20,
Claude Code ≥ 2.1.139 (иначе hooks теряют `args` и память не пишется), Bun/uv ставятся инсталлятором.
Данные — `~/.claude-mem/` (вне репозитория). `npm install -g claude-mem` — ловушка: ставит только SDK, hooks не регистрирует.
Уточнить версию Claude Code в среде до установки.

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Инструмент памяти установлен и работает (hooks зарегистрированы, worker жив) | Прямо в пункте 2 | MEDIUM | Проверка: `command -v claude-mem && claude-mem --version`, `npx claude-mem doctor`, `/hooks` |
| Доказательство «между сессиями»: факт, сообщённый в сессии A, агент воспроизводит в новой сессии B без чтения файлов | Суть требования; без этого «подключена» не доказана | LOW | Выбрать факт, которого нет ни в одном файле репозитория (иначе агент мог прочитать его из `docs/memory.md`); скриншот обеих сессий |
| Описание в README: что ставили, версия, как проверить, где лежат данные | Критерий «описаны результаты для проверки» | LOW | Установка живёт вне git — без README проверяющий ничего не воспроизведёт |
| Согласование установки с автором | `PROJECT.md`: плагины — только по согласованию | LOW | Не зависимость проекта (`package.json` не меняется), но шаг подтверждается по правилам работы |
| Осознанный выбор провайдера сжатия памяти | Инсталлятор по умолчанию предлагает hosted CMEM Pro | LOW | Выбрать вариант без отправки данных на внешний сервис (`--provider claude` по подписке или `--provider host`) и записать выбор в README. Детали — перепроверить в актуальной документации |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Связка памяти с GSD: STATE.md/`.continue-here.md` (структурный чекпойнт) + claude-mem (эпизодическая память) | Показывает разделение ролей: GSD — «где мы в плане», claude-mem — «что обсуждали и решили» | MEDIUM | Описать в README таблицей «что где хранится» |
| Показать поиск по памяти (search tools claude-mem) с цитатой решения из ДЗ-1 | Память полезна не только «в следующей сессии», но и для старых решений | LOW | Если инструмент поиска доступен в установленной версии |
| Запись о выборе в `docs/memory.md` (сделано / решение / дальше / ловушки) | Единая дисциплина записей из `AGENTS.md` | LOW | Обязательна по правилам проекта в любом случае |
| Проверка приватности: `.env*` и секреты не попадают в память | Память пишет вывод инструментов; в проекте есть запрет на `.env` | MEDIUM | Деталь про теги приватности в claude-mem не подтверждена источниками — проверить в docs перед описанием; опираться на то, что чтение `.env*` уже запрещено deny-правилами |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Две системы памяти сразу (claude-mem + MemPalace `/gsd-mempalace-*`) | «Чем больше, тем лучше» | Дубли, конфликт хуков, непонятно, что источник истины | Один инструмент памяти; MemPalace-команды GSD не использовать |
| Засчитывать за «память» только `docs/memory.md` | Уже есть, бесплатно | Это журнал, заведённый руками в ДЗ-1; пункт 2 требует инструмент | `docs/memory.md` остаётся дисциплиной, claude-mem — инструментом |
| Выключить ограничения (permissions) ради работы worker | Hook/worker могут просить доступ | Ослабление защит запрещено `AGENTS.md` | Добавлять точечные allow, согласовывая с автором |
| `npm install -g claude-mem` | Знакомая команда | Не регистрирует hooks, память молча не работает | `npx claude-mem install` или `/plugin install` |
| Хранить базу памяти в репозитории | Воспроизводимость | Приватные данные, бинарный файл, шум в диффах | Описать установку в README; базу не коммитить |

### Пункт 3. Быстрые команды и auto hooks (`SessionStart`, `PreCompact`)

Контекст: GSD уже ставит свои hooks в **`.claude/settings.local.json`** (он в `.gitignore`), включая `SessionStart`.
Hook `gsd-session-state.sh` (SessionStart) — opt-in через `hooks.community: true` в `.planning/config.json`,
по умолчанию выключен. Собственные hooks ДЗ-1 лежат в закоммиченном `.claude/settings.json` (`PreToolUse`, `PostToolUse`).
Документация Claude Code: `SessionStart` не блокирует, сообщает контекст через `additionalContext`,
matcher'ы `startup|resume|clear|compact|fork`; `PreCompact` — matcher `manual|auto`, может блокировать компакцию (exit 2).

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| 3–5 быстрых команд проекта (slash-команды или skills) под реальные повторяющиеся действия | «быстрые команды» в пункте 3 | LOW | Кандидаты: проверка перед PR (`npm run check` + итог), «где мы» (git + GSD progress + последняя запись memory), запись итога сессии в `docs/memory.md`, запуск e2e с `env -u http_proxy …`. Имена не должны начинаться с `gsd-` (этот префикс вне git) |
| Hook `SessionStart`, закоммиченный в `.claude/settings.json` | Названо в пункте 3; GSD-hooks в git не попадают | MEDIUM | Выводит ветку, текущую фазу GSD (из STATE.md), последнюю запись `docs/memory.md`. Быстрый (SessionStart должен быть быстрым), вывод ≤ 10 000 символов |
| Hook `PreCompact`, закоммиченный | Названо в пункте 3 | MEDIUM | Сохраняет чекпойнт перед сжатием (ветка, `git status --short`, позиция в STATE.md). **Не блокировать** компакцию: exit 0 всегда |
| `SessionStart` с matcher `compact`: после сжатия возвращает чекпойнт в контекст | Замыкает пару PreCompact → SessionStart(compact) | MEDIUM | Без этой половины PreCompact бесполезен |
| Логика hooks покрыта тестами Vitest (как `protect-files`, `format-and-lint`) | Подход ДЗ-1; `npm run check` остаётся зелёным | MEDIUM | Чистая функция «входной JSON → вывод» + тонкая обёртка; тесты в `tests/unit/` |
| Доказательство срабатывания: `/hooks` со списком, скриншот вывода SessionStart в новой сессии, лог/файл чекпойнта после `/compact` | Hook «настроен» ≠ «работает» | LOW | `claude --debug-file` как запасной способ показать вызов |
| Описание в README: таблица «событие → hook → что делает → как проверить» | Критерий оценки | LOW | |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Включить `hooks.community: true` и использовать готовый `gsd-session-state.sh` как часть SessionStart | Показывает интеграцию GSD ↔ среда, меньше своего кода | LOW | Правка `.planning/config.json` — через `/gsd-config`/`/gsd-settings`. Но результат лежит в `settings.local.json` (вне git) — в README отметить |
| Быстрая команда «пауза» поверх `/gsd-pause-work` (пишет `.planning/HANDOFF.json` и `.continue-here.md`) | Готовый механизм чекпойнтов GSD, связывает пункты 3 и 4 | LOW | Не изобретать свой формат |
| Hook `SessionStart` читает `seconds_since_last_response`/`prompt_cache_likely_expired` на `resume` | Предупреждение «кэш остыл, дорогой первый запрос» | MEDIUM | Поля из документации (нужен Claude Code ≥ 2.1.251); необязательно |
| Дублирование критичной защиты на жёстком уровне не нужно, но hooks не должны её обходить | Согласованность с ДЗ-1 | LOW | `protect-files` остаётся первым; новые hooks только читают |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| `PreCompact`, блокирующий автокомпакцию (exit 2) | «Заставить закоммитить перед сжатием» | Блокирует нормальную работу при заполнении окна, агент застревает | Сохранить чекпойнт и пропустить; предупреждение — через SessionStart |
| Тяжёлые SessionStart (запуск тестов, сеть, `npm ci`) | «Проверим сразу состояние» | Замедляет каждый старт, ломается в офлайне | Только чтение файлов и git |
| 15 быстрых команд | Выглядит богато | Не «под проект», сложно проверить | 3–5 с описанием «когда нужна» |
| Правка GSD-hooks в `.claude/hooks/gsd-*` | Подстроить под себя | Файлы вне git, перезапишутся при обновлении | Свои hooks рядом, в `settings.json` |
| Класть hooks только в `settings.local.json` | Агент не видит запрета на правку | Не в git → проверяющий не видит и не воспроизведёт | Коммитить в `settings.json` (правку settings подтверждает человек — запрет `AGENTS.md`) |
| Ослаблять `permissions`/линтер, чтобы hook «прошёл» | Быстро | Прямое нарушение `AGENTS.md` | Точечные allow по согласованию |

### Пункт 4. Управление контекстом (автосжатие/чекпойнты) + скриншоты usage до и после

Что уже есть из коробки: Claude Code автокомпактит при заполнении окна; команды `/context`, `/usage`
(в Session-блоке: токены и стоимость; на подписке — полосы плана и разбивка), `/compact [инструкция]`, `/clear`, `/rewind`;
секция «Compact instructions» в `CLAUDE.md` задаёт, что сохранять при сжатии. GSD: `hooks.context_warnings: true`,
`workflow.context_guard_mode: "warn"`, hook `gsd-context-monitor.js`, `gsd-statusline.js`, `/gsd-pause-work` и `/gsd-resume-work`.
«Инструмент управления контекстом» из задания — это комбинация: политика сжатия + чекпойнт + восстановление.

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Явная политика контекста, записанная в репозитории: когда `/compact`, когда `/clear`, что сохраняется | «Внедрён инструмент» нужно показать как решение, а не как случайность | LOW | Раздел «Compact instructions» в `AGENTS.md`/`CLAUDE.md` (держать `AGENTS.md` ≤ 200 строк) + абзац в README |
| Чекпойнт перед сжатием и восстановление после (пункт 3 + `/gsd-pause-work`/`/gsd-resume-work`) | «автосжатие/чек-пойнты» | MEDIUM | Зависит от hooks пункта 3 |
| Скриншот usage ДО | Прямо в задании | LOW | `/context` и/или `/usage` в длинной сессии (высокая доля окна) |
| Скриншот usage ПОСЛЕ | Прямо в задании | LOW | Те же команды после сжатия/перезапуска с восстановлением из чекпойнта |
| Подпись под скриншотами: что именно сравнивается, в одной и той же метрике | Без подписи «до/после» не доказывает эффект | LOW | Например, «заполнение окна 78% → 21%; позиция в плане восстановлена из чекпойнта» |
| Проверка, что после сжатия агент продолжает работу (знает фазу, ветку, следующий шаг) | Сжатие без потерь — смысл чекпойнтов | LOW | Один вопрос агенту после компакта, скриншот ответа |
| Предупреждение о заполнении окна (statusline или context-monitor) | Дешёвая автоматизация | LOW | Уже включено в GSD (`context_warnings`); достаточно показать на скриншоте и упомянуть в README |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Сравнить два сценария на одной задаче: без политики (естественный рост) и с политикой (`/compact` с инструкцией + чекпойнт) | Количественное «до/после», а не «стало лучше» | MEDIUM | Один и тот же шаг (напр. разбор CONCERNS.md); одинаковые метрики |
| Таблица в README: токены, стоимость (оценка), заполнение окна, строка `Prompt cache` из `/usage` | Показывает цену сжатия: компакт большого контекста сам — большой запрос | LOW | Эти строки есть в `/usage` (Claude Code ≥ 2.1.251); стоимость в нём — оценка по прейскуранту, на подписке не счёт |
| Настройка порога автокомпакта (окно/процент) и обоснование | Осознанная конфигурация вместо значений по умолчанию | MEDIUM | Точное имя переменной/параметра **не подтверждено**: страница model-config не открылась. Проверить в документации перед использованием, иначе пропустить |
| Делегирование объёмных операций subagent'ам как часть политики | Ссылка на документацию «delegate verbose operations to subagents» | LOW | У проекта уже есть `reviewer`; достаточно упомянуть и показать пример |
| `/insights` как вторая точка измерения | Отчёт по сессиям в HTML | LOW | Пишет файл в `~/.claude/usage-data/`; может содержать личные данные — в репозиторий не коммитить, только скриншот агрегатов |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Скриншоты «до/после» из разных метрик или разных задач | Что под рукой | Не сопоставимы — проверяющий видит подгонку | Один сценарий, одни команды, подписи |
| Изображать стоимость из `/usage` как реальные расходы | Красиво | На подписке это оценка по прейскуранту, не счёт | Явная пометка «оценка» |
| Жёсткая автоматика, которая сама чистит контекст (`/clear` из hook) | «Полная автономия» | Теряется рабочий контекст; `/clear` из hook недоступен как действие | Предупреждение + ручное решение + чекпойнт |
| Отдельный самописный «менеджер контекста» (скрипт-суммаризатор) | «Свой инструмент» | Дублирует встроенный `/compact`, лишний код под поддержку | Политика + встроенные средства + GSD-чекпойнты |
| Очищать `STATE.md`/авто-prune (`auto_prune_state`) ради «экономии» | Меньше токенов | Теряется история решений GSD | Оставить `false`, как в config |

### Пункт 5. Discovery в GSD для вехи «продление и пени»

#### Что такое Discovery в GSD (по исходникам `workflows/`)

В GSD **нет команды или стадии с именем «Discovery»**. Пункт ДЗ («этап Discovery в GSD или аналогичном»)
реализуется цепочкой, которая отвечает на вопросы «что строим и зачем» до планирования. Состав:

| Шаг | Команда | Вопрос | Артефакты | Требует фазу в ROADMAP |
|-----|---------|--------|-----------|------------------------|
| 1. Идея | `/gsd-explore <тема>` | Что мы вообще хотим? | По выбору автора (до 4): `.planning/notes/{slug}.md`, `.planning/todos/pending/{slug}.md`, seed `SEED-…` (через `/gsd-capture --seed`, с `trigger_when`), `.planning/research/questions.md`, дописанные REQ в `REQUIREMENTS.md`, новая фаза в `ROADMAP.md`, либо запуск `/gsd-spike` / `/gsd-sketch`. Ничего не пишется без явного выбора | Нет |
| 2. Спецификация (WHAT) | `/gsd-spec-phase N` | Что фаза доставляет, где границы, как поймём, что готово? | `.planning/phases/NN-slug/NN-SPEC.md`: оценка неопределённости по 4 измерениям (цель 35% / границы 25% / ограничения 20% / приёмка 20%), порог ≤ 0.20 и минимумы по каждому; до 6 раундов интервью; секции Edge Coverage и Prohibitions; Interview Log. Коммит `spec(phase-N): …` | Да |
| 3. Решения (HOW) | `/gsd-discuss-phase N` | Какие серые зоны реализации решаем сейчас? | `NN-CONTEXT.md` (границы фазы, `<spec_lock>`, зафиксированные решения с рейтингом обратимости, Deferred Ideas) и журнал обсуждения `NN-DISCUSSION-LOG.md`; подхватывает SPEC.md как «заблокированные» требования | Да |
| 4. Исследование домена | `/gsd-new-milestone` → шаг «Research» | Что есть в экосистеме для новых возможностей? | 4 параллельных исследователя → `.planning/research/{STACK,FEATURES,ARCHITECTURE,PITFALLS}.md` + `SUMMARY.md`; затем `REQUIREMENTS.md` с REQ-ID и `ROADMAP.md` (roadmapper); обновлённые `PROJECT.md`, `STATE.md` | Нет (создаёт веху) |
| 5. (после Discovery) | `/gsd-plan-phase N` | Как именно? | `NN-RESEARCH.md`, `NN-PLAN.md` | Да |

Ограничения, важные для планирования:

- `spec-phase` и `discuss-phase` завершаются ошибкой «фаза не найдена в roadmap», если фазы нет. Для вехи «продление и пени»
  значит либо (а) завести фазу в roadmap текущей вехи, либо (б) положить её в backlog (`999.x`, `/gsd-capture --backlog`) и
  работать с ней, либо (в) запустить `/gsd-new-milestone`, который архивирует фазы текущей вехи ДЗ-2 — делать только после её завершения.
- `/gsd-new-milestone` и `/gsd-new-project` не путать с Discovery-шагами: они меняют `PROJECT.md`/`STATE.md`/`ROADMAP.md` целиком.
- Режим `--auto` в `spec-phase`/`discuss-phase` подставляет «рекомендованные» ответы вместо автора — для учебного Discovery не использовать (правило «каждый шаг подтверждает автор»).
- Исследовательские выводы GSD помечает `admit / refute / abstain`; нераспознанные утверждения нельзя записывать как факт — переносить в журнал «неподтверждённого».

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| `/gsd-explore` по теме «продление и пени» → хотя бы note + research-questions + seed/todo | Начало Discovery, ещё без обязательств | LOW | Автор отвечает по одному вопросу; артефакты в git |
| `SPEC.md` для фазы «Продление и пени» с ambiguity ≤ 0.20 и falsifiable-требованиями | Главный артефакт «пройденного Discovery» | MEDIUM | См. вопросы домена ниже; в SPEC.md — границы «не делаем» (бронирование, роли, платёжные интеграции) |
| `CONTEXT.md` от `/gsd-discuss-phase` с принятыми решениями и Deferred Ideas | Показывает переход от WHAT к HOW | MEDIUM | Серые зоны — конкретные, не «UI/UX» |
| Реальная фаза в ROADMAP для Discovery (или backlog-запись), чтобы команды отработали штатно | Технически необходимо для `spec-phase`/`discuss-phase` | LOW | Решение для требований: фаза внутри ДЗ-2 vs backlog (см. Open Questions) |
| Никакого кода продления/пеней | Out of Scope в `PROJECT.md` | LOW | Discovery заканчивается готовностью к `/gsd-plan-phase`, но не самим планом |
| Доказательство: скриншот(ы) интервью с оценкой неопределённости + ссылка на SPEC/CONTEXT в README + коммиты `spec(phase-N)` / `docs: …` | Проверяемость | LOW | |

Вопросы домена, которые Discovery должен закрыть (содержательная проверка качества SPEC):

- Продление: сколько раз можно продлить; на какой срок (14 дней как у выдачи или иначе); можно ли продлять просроченную выдачу;
  как продление влияет на `dueAt` (политика хранится в выдаче или в конфиге — в `CONCERNS.md` отмечено, что политика сейчас зашита в `DEFAULT_LOAN_POLICY`).
- Пени: ставка в день, потолок, единица (валюта/«баллы»), округление, когда начисляются (на возврате или расчётно по `now`),
  блокирует ли неоплаченная пеня новую выдачу, нужна ли отметка «оплачено».
- Ограничения проекта, влияющие на решения: даты в домене только параметром `now: Date`; формат данных не менять без миграции
  (`AGENTS.md`) — продление/пени добавляют поля в выдачу, значит нужна миграция JSON; отказы домена — типизированный результат с кодом → `409`.

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Edge Coverage и Prohibitions внутри SPEC.md (шаг 5.5 `spec-phase`) | Сразу видны граничные случаи: продление в день возврата, нулевая пеня, пеня за просрочку после продления | MEDIUM | Движок `edge-probe` встроен; для русскоязычных требований нужен `text_en` (описано в workflow) |
| Spike на спорную техническую часть (напр. хранение истории продлений в JSON без ломки формата) | Превращает неопределённость в факт до планирования | MEDIUM | `/gsd-spike`; только если после интервью остались технические сомнения |
| Мини-исследование «как устроены продления и пени в библиотеках» через `/gsd-new-milestone` research или explore-research | Показывает умение опираться на источники | MEDIUM | Если сделать — выводы с пометками admit/abstain и источниками; не обязательно |
| Сквозная трассировка: seed/REQ → SPEC → CONTEXT → заготовка вехи v1.1 в backlog | Дискавери «встроен» в цикл GSD, а не лежит отдельным документом | LOW | |
| Короткое резюме для README: 5 строк «что решили / что отложили» | Проверяющему не нужно читать весь SPEC | LOW | |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Реализовать продление/пени «заодно» | Скучно останавливаться на документах | Прямо в Out of Scope; ломает границу вехи | Оставить в backlog/следующей вехе |
| Прогнать `/gsd-new-milestone` до завершения ДЗ-2 | «Полноценный цикл» | Архивирует и перестраивает roadmap текущей вехи, `docs/plan.md`/README ссылаются на него | После PR вехи ДЗ-2 либо отдельно |
| `--auto` во всех шагах Discovery | Быстро | Ответы подставляет модель — Discovery теряет смысл «уточнить у автора» | Интерактивный режим |
| Писать SPEC без интервью («по шаблону») | Экономит время | Нет Interview Log и оценки — нет доказательства прохождения этапа | Хотя бы 2–3 раунда, скриншот оценки |
| Расширять scope Discovery: бронирование, очереди, роли, платежи | Тема соседняя | `discuss-phase` запрещает scope creep; всё это в roadmap будущих ДЗ | Deferred Ideas в CONTEXT.md |
| Принимать утверждения исследователя без источника | Быстрее | В GSD такие утверждения нужно переносить как `abstain` | Источник или «не подтверждено» |

### Пункт 6. README «Модуль 2», PR, зелёный `npm run check`

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Раздел README «Модуль 2: агентно-ориентированный пайплайн» с оглавлением по пунктам 1–5 ДЗ | Критерий оценки | MEDIUM | Структура: пункт ДЗ → что сделано → где лежит (ссылка) → как проверить (команда) → доказательство (скриншот) |
| Таблица доказательств: пункт / артефакт / команда проверки / скриншот | Проверка за минуту | LOW | Образец — отчёт ДЗ-1 (`docs/about.md`, скриншоты в `docs/screenshots/`) |
| Скриншоты в `docs/screenshots/` с префиксом `hw2-` | Единообразие с ДЗ-1 | LOW | Не менее: `/gsd-progress`, `/gsd-health`, память сессия A/B, `/hooks`, SessionStart, usage до, usage после, интервью Discovery |
| Раздел «Что не воспроизводится из git» (GSD Core, claude-mem, `settings.local.json`) и команды их восстановления | Установка вне git; иначе проверяющий не повторит | LOW | `npx @opengsd/gsd-core@1.18.0 --claude --local`, установка claude-mem, Node ≥ 24 |
| Ограничения и честные оговорки (эвристика hooks, оценка стоимости, что Discovery — цепочка команд) | Доверие к отчёту | LOW | В духе ДЗ-1 («эвристика, не песочница») |
| PR в `main` из `feat/module-2`, заголовок и описание на русском, без атрибуции агента | Правила `AGENTS.md` | LOW | `gh pr create` в списке ask — подтверждает человек |
| `npm run check` зелёный (включая тесты новых hooks); e2e — если менялся UI (не меняется) | Правило готовности | LOW | |
| Запись в `docs/memory.md` по итогам сессий | Правило `AGENTS.md` | LOW | |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| `/gsd-milestone-summary` или `/gsd-ship` для PR-описания с рисками и критериями | Использует GSD end-to-end (раздел `ship.pr_body_sections` настроен в config) | LOW | PR-тело править под правило «на русском, без атрибуции» |
| Тег `hw2-submitted` после merge | Симметрия с `hw1-submitted` | LOW | |
| Чек-лист самопроверки в README («пройди за 5 минут»), 5–7 команд | Быстрая проверка проверяющим | LOW | |
| `/review-step` (skill ДЗ-1) на ветке перед PR | Показывает, что среда ДЗ-1 работает вместе с ДЗ-2 | LOW | |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| README на 500 строк с копией документов GSD | Полнота | Проверяющий тонет; копии расходятся с источником | Ссылки на файлы + таблица |
| Скриншоты без подписей и без дат/команд на кадре | Быстро | Не доказывают, что именно измерено | Подпись под каждым; команда видна на скриншоте |
| Коммитить в `main`, `push --force` | Быстрее | Запрещено `AGENTS.md` и deny-правилами | Ветка + PR |
| «Generated with Claude Code» / `Co-Authored-By` | Привычка | Запрещено правилами проекта | Чистое описание |

## Feature Dependencies

```
Пункт 1: REQUIREMENTS.md → ROADMAP.md → STATE.md → PLAN.md (хотя бы одной фазы)
    └──requires──> .planning/PROJECT.md + codebase map (готово)
Пункт 1: security-checklist ──requires──> .planning/codebase/CONCERNS.md (готово)
Пункт 1: единый источник плана ──requires──> ROADMAP.md

Пункт 3: hooks SessionStart/PreCompact ──requires──> закоммиченный .claude/settings.json (правку подтверждает автор)
Пункт 3: тесты hooks ──requires──> npm ci + tsx (как в ДЗ-1)

Пункт 2: память (claude-mem) ──enhances──> Пункт 3 (SessionStart может читать память)
Пункт 4: чекпойнты ──requires──> Пункт 3 (PreCompact + SessionStart(compact)) и /gsd-pause-work
Пункт 4: скриншоты до/после ──requires──> длинная сессия + политика контекста (до этого «до» нечего снимать)

Пункт 5: /gsd-spec-phase, /gsd-discuss-phase ──requires──> фаза в ROADMAP (из пункта 1)
Пункт 5: Discovery ──enhances──> Пункт 2 (длинный диалог — естественный сценарий для проверки памяти и контекста)
Пункт 5: Discovery ──conflicts──> реализация продления/пеней (Out of Scope)
Пункт 5: /gsd-new-milestone ──conflicts──> незавершённая веха ДЗ-2 (архивирует её фазы)

Пункт 6: README ──requires──> все артефакты и скриншоты пунктов 1–5
Пункт 6: PR ──requires──> зелёный npm run check
```

### Dependency Notes

- **Пункт 4 зависит от пункта 3:** чекпойнт, который не записывается автоматически перед сжатием, — это ручной процесс, а не «автосжатие/чек-пойнты».
- **Пункт 5 зависит от пункта 1:** без фазы в roadmap workflows `spec-phase`/`discuss-phase` останавливаются.
- **Порядок съёмки скриншотов совпадает с порядком работы:** память и usage удобно снимать *во время* Discovery и других шагов, а не отдельно «для галочки».
- **Правки `.claude/settings.json` делает человек или с его подтверждения:** `CONCERNS.md` отмечает, что агент способен править эти настройки; в ДЗ-2 это требуется, значит каждый такой шаг подтверждается явно.

## MVP Definition

### Launch With (ДЗ-2 сдано)

- [ ] ROADMAP/REQUIREMENTS/STATE + хотя бы один PLAN.md; `docs/plan.md` ссылается на ROADMAP — пункт 1
- [ ] Architecture (выжимка) и security-checklist под проект, ссылки из README — пункт 1
- [ ] claude-mem установлен, проверка «сессия A → сессия B», README-описание — пункт 2
- [ ] 3–5 быстрых команд; hooks SessionStart и PreCompact в `settings.json`, тесты логики — пункт 3
- [ ] Политика контекста, чекпойнт/восстановление, скриншоты usage до и после с подписями — пункт 4
- [ ] explore → SPEC.md → CONTEXT.md по «продление и пени», без кода — пункт 5
- [ ] README «Модуль 2», PR из `feat/module-2`, `npm run check` зелёный — пункт 6

### Add After Validation (если останется время)

- [ ] `/gsd-secure-phase` на фазе для сверки угроз — когда security-checklist оформлен в формате SECURITY.md
- [ ] Spike по хранению истории продлений — если после интервью остались технические сомнения
- [ ] Сравнение двух сценариев работы с контекстом (с политикой и без) в числах

### Future Consideration (следующие ДЗ/вехи)

- [ ] Реализация продления и пеней (`/gsd-plan-phase` → `/gsd-execute-phase`) — следующая веха
- [ ] Исправление находок CONCERNS.md (дубли формы, общий файл e2e) — отдельные задачи
- [ ] SQLite, роли, бронирование, ISBN-интеграции — roadmap ДЗ-3…ДЗ-8

## Feature Prioritization Matrix

| Feature | Ценность для проверки | Стоимость | Приоритет |
|---------|-----------------------|-----------|-----------|
| ROADMAP + PLAN + STATE (GSD init) | HIGH | MEDIUM | P1 |
| Architecture + security-checklist | HIGH | MEDIUM | P1 |
| Память между сессиями + доказательство A/B | HIGH | MEDIUM | P1 |
| Hooks SessionStart/PreCompact + тесты | HIGH | MEDIUM | P1 |
| Быстрые команды (3–5) | MEDIUM | LOW | P1 |
| Скриншоты usage до/после + политика контекста | HIGH | MEDIUM | P1 |
| Discovery: explore → SPEC → CONTEXT | HIGH | MEDIUM | P1 |
| README «Модуль 2» + таблица доказательств | HIGH | MEDIUM | P1 |
| Security-checklist в формате GSD SECURITY.md | MEDIUM | MEDIUM | P2 |
| Сравнение сценариев «с политикой / без» | MEDIUM | MEDIUM | P2 |
| Edge Coverage / Spike / research в Discovery | MEDIUM | MEDIUM | P2 |
| Тег `hw2-submitted`, `/gsd-ship` | LOW | LOW | P3 |

## Evidence Map (что снимать и какие команды показывать)

| Пункт | Файлы в git | Команда проверки | Скриншот (`docs/screenshots/`) |
|-------|-------------|------------------|--------------------------------|
| 1. GSD init | `.planning/ROADMAP.md`, `REQUIREMENTS.md`, `STATE.md`, `phases/*/…-PLAN.md`, architecture, security-checklist | `/gsd-progress`, `/gsd-health` | `hw2-gsd-progress.png`, `hw2-gsd-health.png` |
| 2. Память | README-раздел, запись в `docs/memory.md` | `claude-mem --version`, `npx claude-mem doctor`, вопрос в новой сессии | `hw2-memory-session-a.png`, `hw2-memory-session-b.png` |
| 3. Команды и hooks | `.claude/settings.json`, `.claude/hooks/*.ts`, `.claude/commands/<имя>.md` или skills, `tests/unit/*hook*.test.ts` | `/hooks`, `npm test`, запуск быстрой команды | `hw2-hooks-list.png`, `hw2-session-start.png`, `hw2-precompact-checkpoint.png` |
| 4. Контекст | политика в `AGENTS.md`/README, чекпойнт-файл | `/context`, `/usage`, `/compact`, `/gsd-resume-work` | `hw2-usage-before.png`, `hw2-usage-after.png`, `hw2-after-compact-resume.png` |
| 5. Discovery | `.planning/notes/*`, `.planning/research/questions.md`, `.planning/phases/NN-*/NN-SPEC.md`, `NN-CONTEXT.md`, `NN-DISCUSSION-LOG.md` | `/gsd-explore`, `/gsd-spec-phase N`, `/gsd-discuss-phase N` | `hw2-discovery-explore.png`, `hw2-discovery-spec-score.png` |
| 6. Сдача | README, PR | `npm run check` | `hw2-check-green.png` |

## Open Questions для этапа требований

1. **Где живёт фаза Discovery:** (а) отдельная фаза в roadmap вехи ДЗ-2 («Discovery: продление и пени», результат — SPEC+CONTEXT, без кода) или (б) backlog `999.x`. Рекомендация: (а) — команды `spec-phase`/`discuss-phase` отрабатывают штатно, проверяющий видит Discovery в ROADMAP и прогрессе.
2. **Провайдер claude-mem** и политика данных — решает автор; рекомендация — без hosted-сервиса по умолчанию.
3. **Версия Claude Code в среде** (нужна ≥ 2.1.139 для claude-mem; ≥ 2.1.251 для строки `Prompt cache` и полей `SessionStart` на resume) — проверить `claude --version`.
4. **Параметр порога автокомпакта** — имя настройки не подтверждено; уточнить в документации или не использовать.
5. **Правки `.claude/settings.json` агентом:** каждый шаг подтверждает автор (ограничение `AGENTS.md` и находка `CONCERNS.md`).

## Sources

- Локальные исходники GSD Core 1.18.0 (HIGH): `.claude/gsd-core/workflows/explore.md`, `spec-phase.md`, `discuss-phase.md`, `new-milestone.md`, `add-backlog.md`, `pause-work.md`; шаблоны `templates/SECURITY.md`, `discuss-phase/templates/context.md`
- Локальные файлы проекта (HIGH): `.planning/PROJECT.md`, `.planning/config.json`, `.planning/codebase/CONCERNS.md`, `docs/homework-2.md`, `docs/plan.md`, `.claude/settings.json`, `.gitignore`
- Claude Code hooks (HIGH, официальная документация): https://code.claude.com/docs/en/hooks — PreCompact, PostCompact, SessionStart, SessionEnd (прочитана первая часть страницы; поля входа PreCompact не проверены)
- Claude Code costs (HIGH, официальная документация): https://code.claude.com/docs/en/costs — `/usage`, `/context`, `/compact`, `/clear`, `/rewind`, `/insights`, строка `Prompt cache`
- claude-mem installation (MEDIUM, официальная документация проекта): https://docs.claude-mem.ai/installation — установка, требования, проверка, расположение данных, ловушка с `npm install -g`
- Поиск по установке claude-mem (MEDIUM): результаты WebSearch, включая https://www.datacamp.com/tutorial/claude-mem-guide (сторонний обзор; расхождение по версии Node между страницами — взять строгую)
- Не подтверждено: теги приватности claude-mem, имя параметра окна автокомпакта (страница model-config не открылась) — помечено в тексте
