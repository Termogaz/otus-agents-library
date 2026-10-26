# Архитектура среды агента

Документ описывает среду, в которой агент (Claude Code) разрабатывает проект: какие файлы им
управляют, в каком порядке они срабатывают и где лежат доказательства работы. Архитектура самого
приложения (слои `domain` → `server` → `client`, репозиторий, API) описана отдельно —
[`.planning/codebase/ARCHITECTURE.md`](../.planning/codebase/ARCHITECTURE.md).

Принцип прежний, из ДЗ-1 ([`docs/about.md`](about.md)): важное держит жёсткий уровень
(permissions, hooks, тесты), стиль и процесс задаёт мягкий (инструкции, rules, skills).

## Слои

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ 1. Инструкции   CLAUDE.md → @AGENTS.md, @.planning/STATE.md                  │
│                 .claude/rules/*.md (по paths:), .claude/skills/*/SKILL.md    │
├──────────────────────────────────────────────────────────────────────────────┤
│ 2. Планирование GSD Core 1.18.0: .planning/ROADMAP.md, REQUIREMENTS.md,      │
│                 STATE.md, phases/<NN>-*/ (SPEC, CONTEXT, PLAN, VERIFICATION)  │
├──────────────────────────────────────────────────────────────────────────────┤
│ 3. Память       claude-mem (вне git) │ auto memory (вне git) │ docs/memory.md │
├──────────────────────────────────────────────────────────────────────────────┤
│ 4. Hooks        SessionStart · PreCompact · PreToolUse · PostToolUse         │
│                 .claude/hooks/*.ts, регистрация в .claude/settings.json       │
├──────────────────────────────────────────────────────────────────────────────┤
│ 5. Контекст     autoCompactWindow 200k · чек-пойнт · statusline · монитор     │
└──────────────────────────────────────────────────────────────────────────────┘
  Сквозное: permissions в .claude/settings.json и security-checklist
```

### 1. Инструкции

| Файл                                                                                         | Когда грузится                           | Что задаёт                                                                                           |
| -------------------------------------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [`CLAUDE.md`](../CLAUDE.md)                                                                  | каждая сессия                            | только импорты: `@AGENTS.md` и `@.planning/STATE.md`                                                 |
| [`AGENTS.md`](../AGENTS.md)                                                                  | через `CLAUDE.md`                        | стек, команды, слои, стиль, процесс, запреты, политика контекста, ловушки                            |
| [`.claude/rules/domain.md`](../.claude/rules/domain.md), [`e2e.md`](../.claude/rules/e2e.md) | при работе с `src/domain/`, `tests/e2e/` | чистота домена; правила e2e                                                                          |
| [`.claude/skills/`](../.claude/skills/)                                                      | по описанию или явному вызову            | `write-tests`, `review-step`, быстрые команды `lib-check`, `lib-status`, `lib-handoff`, `lib-commit` |
| [`.claude/agents/reviewer.md`](../.claude/agents/reviewer.md)                                | в `/review-step`                         | read-only ревьюер в отдельном контексте                                                              |

Правила пишутся один раз в `AGENTS.md`, чтобы ими мог пользоваться любой агент. В `CLAUDE.md` правил нет.
Позиция в плане приходит в каждую сессию вместе с `STATE.md`, поэтому агенту не нужно её искать.

Быстрые команды `/lib-*` — это skills с префиксом `lib-`: без префикса skill перекрыл бы встроенную
команду. `lib-handoff` и `lib-commit` что-то меняют, поэтому запускаются только явным вызовом
(`disable-model-invocation`). Права в их `allowed-tools` проверяет
[`tests/unit/lib-skills.test.ts`](../tests/unit/lib-skills.test.ts).

### 2. Планирование

Единственный источник плана — каталог [`.planning/`](../.planning/) GSD Core.
[`docs/plan.md`](plan.md) остался указателем на него и историей ДЗ-1.

| Артефакт                                                                                     | Роль                                                                        |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [`PROJECT.md`](../.planning/PROJECT.md)                                                      | цель вехи, ключевые решения, что вне объёма                                 |
| [`REQUIREMENTS.md`](../.planning/REQUIREMENTS.md)                                            | требования вехи (PLAN, SEC, MEM, HOOK, CTX, DISC, DOC) с отметками          |
| [`ROADMAP.md`](../.planning/ROADMAP.md)                                                      | 5 фаз, критерии успеха каждой                                               |
| [`STATE.md`](../.planning/STATE.md)                                                          | текущая позиция; импортируется в `CLAUDE.md`                                |
| [`codebase/`](../.planning/codebase/)                                                        | карта кода (`/gsd-map-codebase`): архитектура, стек, риски                  |
| [`phases/01-…/`](../.planning/phases/01-bazovaya-liniya-edinyy-plan-i-gigiena-bezopasnosti/) | полный цикл: `CONTEXT` → `PLAN` ×9 → `SUMMARY` → `REVIEW` → `VERIFICATION`  |
| [`phases/04-…/`](../.planning/phases/04-discovery-prodlenie-i-peni/)                         | Discovery: `SPEC` (ambiguity 0.17) → `CONTEXT` с итогом «решили / отложили» |

Полный цикл GSD с агентами прошла только фаза 1. Фазы 2–3 выполнены шагами по `AGENTS.md`
без GSD-агентов, ради экономии токенов. В фазе 4 использованы только команды Discovery:
`/gsd-explore` → `/gsd-spec-phase` → `/gsd-discuss-phase`. `commit_docs: false`: GSD ничего
не коммитит сам, артефакты коммитятся вручную.

### 3. Память

| Уровень                 | Где                                                 | В git | Что хранит                                                 |
| ----------------------- | --------------------------------------------------- | ----- | ---------------------------------------------------------- |
| claude-mem 15.0.1       | `~/.claude-mem/` (SQLite + Chroma), worker `:37700` | нет   | сжатые наблюдения за сессиями, поиск через MCP             |
| auto memory Claude Code | `~/.claude/projects/<проект>/memory/`               | нет   | предпочтения автора и обратная связь                       |
| журнал проекта          | [`docs/memory.md`](memory.md)                       | да    | запись на каждый шаг: Сделано / Решение / Дальше / Ловушки |

Основная память — claude-mem: провайдер сжатия Anthropic (Haiku), телеметрия выключена,
маскирование секретов (`CLAUDE_MEM_REDACT_*`) включено после канарейки MEM-02. Запасной
вариант (MEM-04) работает без плагинов: журнал `docs/memory.md` и позиция из `STATE.md`
приходят в сессию дайджестом hook `SessionStart`.

### 4. Hooks

Проектные hooks написаны на TypeScript, запускаются через `tsx` и зарегистрированы в закоммиченном
[`.claude/settings.json`](../.claude/settings.json). Общий код лежит в [`.claude/hooks/lib/`](../.claude/hooks/lib/):
`shell.ts` (токенизатор Bash), `secret-names.ts`, `hook-input.ts` (zod-схемы входа), `hook-utils.ts`.

| Событие (matcher)                                  | Hook                                                            | Поведение                                                                                                                        | Тесты                                    |
| -------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `SessionStart` (`startup\|resume\|clear\|compact`) | [`session-start.ts`](../.claude/hooks/session-start.ts)         | дайджест ≤ 3 КБ: ветка, незакоммиченные файлы, позиция GSD, верхняя запись журнала; после сжатия — чек-пойнт                     | `session-start.test.ts`                  |
| `PreCompact` (`manual\|auto`)                      | [`pre-compact.ts`](../.claude/hooks/pre-compact.ts)             | пишет `.local/checkpoints/last.md` (вне git); код выхода всегда 0, сжатие не блокирует                                           | `pre-compact.test.ts`                    |
| `PreToolUse` (`Edit\|Write\|Bash`)                 | [`protect-files.ts`](../.claude/hooks/protect-files.ts)         | запрет чтения и записи `.env*`, записи в `.git/` и `package-lock.json`; запрос подтверждения на запись в `.claude/`; fail-closed | `protect-files.test.ts`, `shell.test.ts` |
| `PostToolUse` (`Edit\|Write`)                      | [`format-and-lint.ts`](../.claude/hooks/format-and-lint.ts)     | Prettier и ESLint после правки, ошибки возвращаются агенту                                                                       | `format-and-lint.test.ts`                |
| `PreToolUse` во frontmatter `reviewer`             | [`reviewer-readonly.ts`](../.claude/hooks/reviewer-readonly.ts) | ревьюеру разрешён только белый список команд на чтение                                                                           | `reviewer-readonly.test.ts`              |

Регистрацию hooks и permissions закрепляет [`tests/unit/settings-permissions.test.ts`](../tests/unit/settings-permissions.test.ts).
Hooks GSD (`gsd-*.js`, `gsd-*.sh`: монитор контекста, guards, statusline) — сторонние: установщик
кладёт их локально и регистрирует в `.claude/settings.local.json`. В git их нет.

### 5. Контекст

```text
 работа ──► statusline пишет метрики ──► монитор GSD: WARNING ≤35% остатка, CRITICAL ≤25%
   │
   └─► ~167k из окна 200k ──► PreCompact: чек-пойнт ──► сжатие ──► SessionStart(compact):
                                                                    дайджест + чек-пойнт
```

- **Порог.** В `.claude/settings.json` стоит `autoCompactWindow: 200000`, сжатие начинается около 167k.
  При старте сессия занимает ~37k, так что запаса хватает примерно на 4,5 таких объёма. Порог задан
  только в проектных настройках: `/autocompact` записал бы второй порог в пользовательские.
- **Возврат позиции.** После сжатия, ручного или автоматического, цепочка `PreCompact` → чек-пойнт →
  `SessionStart(compact)` возвращает агенту фазу, ветку и шаг (CTX-02).
- **Statusline и монитор.** Это готовые скрипты GSD. Statusline подключён в `settings.local.json`
  и пишет метрики, которые читает `gsd-context-monitor.js`.
- **Политика.** Раздел «Контекст» в [`AGENTS.md`](../AGENTS.md): `/compact` — между шагами задачи,
  `/clear` — при смене задачи, а перед ними нужна запись в журнал и коммит.
- **Замеры.** [`docs/context-usage.md`](context-usage.md) — снимки `/context` и `/usage` до и после на одном сценарии.

### Сквозное: безопасность

Permissions в `.claude/settings.json`: `deny` — `.env*`, правка `package-lock.json`,
`rm -rf`, `git push --force`, `git push origin main`; `ask` — `Edit(./.claude/**)`,
`git push`, `gh pr`, `npm install`. Второй слой — hook `protect-files`: он ловит обходы через Bash,
которые шаблоны permissions пропускают. Каждый пункт с командой проверки и статусом —
в [`docs/security-checklist.md`](security-checklist.md).

## Что в git, а что нет

| В git (воспроизводится клоном)                                               | Вне git (восстанавливается командами из README)        |
| ---------------------------------------------------------------------------- | ------------------------------------------------------ |
| `AGENTS.md`, `CLAUDE.md`, `.claude/settings.json`, rules, skills, `reviewer` | GSD Core: команды, агенты и hooks `gsd-*` в `.claude/` |
| проектные hooks `.claude/hooks/*.ts` и их тесты                              | `.claude/settings.local.json`: hooks GSD, statusline   |
| `.planning/` (кроме служебного `state.json`)                                 | данные claude-mem `~/.claude-mem/`, auto memory        |
| `docs/memory.md`, `docs/context-usage.md`, `docs/screenshots/`               | чек-пойнты `.local/checkpoints/`                       |
