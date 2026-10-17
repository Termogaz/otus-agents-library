# План проекта «Библиотека»

Учебный проект курса OTUS «AI Agents»: веб-приложение библиотеки (книги, читатели, выдача)
и AI-ориентированная среда разработки с coding-агентом Claude Code вокруг него.

Правило работы: каждый шаг обсуждается (зачем, как связан с ДЗ) и выполняется только после подтверждения.

## Стек

| Роль               | Выбор                                                 |
| ------------------ | ----------------------------------------------------- |
| Язык               | TypeScript (strict)                                   |
| Backend            | Express 5, валидация zod                              |
| Frontend           | React + Vite                                          |
| Хранилище          | JSON-файл за интерфейсом репозитория (позже SQLite)   |
| Менеджер пакетов   | npm                                                   |
| Unit / API тесты   | Vitest + supertest                                    |
| E2E                | Playwright Test; проверка UI агентом — Playwright MCP |
| Линтер / форматтер | ESLint (typescript-eslint) + Prettier                 |
| Агент              | Claude Code                                           |

## Структура

```text
src/domain/   чистые бизнес-правила (без Express, I/O, React)
src/server/   Express: routes, валидация, хранилище
src/client/   React UI
tests/unit/   Vitest
tests/e2e/    Playwright
docs/         plan.md, memory.md, about.md
.claude/      rules, skills, hooks, settings.json
```

## MVP (объём ДЗ)

- Книги: название, автор, ISBN, количество экземпляров.
- Читатели: имя, контакт.
- Выдача и возврат книги.
- Правила: нельзя выдать книгу без свободных экземпляров; лимит книг на читателя;
  срок выдачи и статус «просрочена».

## Запреты для агента

Принцип: важное дублируем жёстким уровнем; стиль и соглашения — мягким.

| Уровень                        | Где                     | Сила               | Что запрещаем                                                                                                                                                                    |
| ------------------------------ | ----------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. AGENTS.md, «Правила работы» | корень                  | мягкий             | коммиты в `main` (только ветки `feat/*`); новые npm-зависимости без согласования; изменение формата данных без миграции; отключение тестов и линтера (`eslint-disable`, `.skip`) |
| 2. Rules с `paths:`            | `.claude/rules/*.md`    | мягкий, точечный   | `src/domain/`: импорт Express, `fs`, React; `tests/e2e/`: `waitForTimeout`, CSS-селекторы вместо локаторов по роли                                                               |
| 3. Permissions `deny` / `ask`  | `.claude/settings.json` | жёсткий            | deny: `Read(.env*)`, `Bash(cat .env*)`, `Bash(rm -rf:*)`, `Bash(git push --force:*)`, `Bash(npm publish:*)`; ask: `git push`                                                     |
| 4. Hook `PreToolUse`           | `.claude/hooks/`        | жёсткий, с логикой | запись в `.env*`, `.git/`, `package-lock.json`, в т.ч. через Bash (`echo > .env`, `sed -i`)                                                                                      |

Ограничение: deny-правила и hook для Bash — эвристика по шаблонам, а не песочница; это фиксируется в `docs/about.md`.

## Шаги ДЗ

Порядок изменён (2026-10-17): MVP-домен пишем после настройки среды, чтобы он стал живой
демонстрацией правил, навыков, hooks и памяти.

- [x] Шаг 0. Выбор проекта, агента и стека; место проекта `~/projects/library`
- [x] Шаг 0.1. `git init`, `.gitignore`, репозиторий на GitHub (Termogaz/otus-agents-library; временно private, сделать public перед сдачей)
- [x] Шаг 0.2. Каркас приложения: package.json, TypeScript, Express, React/Vite, Vitest, ESLint, Prettier
- [x] Шаг 1. `AGENTS.md` (≤200 строк, 4 раздела) + `CLAUDE.md` → `@AGENTS.md`
- [x] Переход: дальше работаем в сессии, запущенной из проекта (`cd ~/projects/library && claude`)
- [x] Шаг 2. Rules с `paths:` (domain, e2e): `.claude/rules/domain.md`, `.claude/rules/e2e.md`
- [ ] Шаг 2. Проверка rule «в своей папке / в соседней» (`src/domain/` vs `src/server/`) — в новой сессии
- [x] Шаг 2. Skills: `write-tests` (вызывает агент), `review-step` (вызываю вручную; read-only через subagent `reviewer`)
- [x] Шаг 2. Проверка skill `/review-step` на ветке `feat/skills`: замечания ревью исправлены
- [ ] Шаг 2. Проверка skill `write-tests` — автовызов в шаге 0.3
- [x] Шаг 3. Permissions allow / ask / deny; режим по умолчанию `acceptEdits`; `settings.local.json` в `.gitignore`
- [x] Шаг 3. Проверка: `cat .env`, `Read(.env)`, `git push --force` — denied; `git push` — запрос подтверждения
- [x] Шаг 4. Hooks: `format-and-lint` (PostToolUse) после правки; `protect-files` (PreToolUse) — запись в `.env*`, `.git/`, `package-lock.json`, в т.ч. через Bash; логика покрыта тестами
- [x] Шаг 4. Память: `docs/memory.md` заведён досрочно (по ревью шага 2), записи — с шага 0
- [x] Шаг 4. Read-only агента `reviewer`: hook `reviewer-readonly` во frontmatter агента (белый список команд)
- [x] Шаг 4. Проверка hook'а `reviewer` в новой сессии: `touch` — отказ, `git status` — проходит
- [ ] Шаг 0.3. MVP-домен через TDD — уже внутри настроенной среды; заодно демонстрации:
      rule для `src/domain/` vs `src/server/`, автовызов `write-tests` (закрывает проверку skills шага 2),
      срабатывание линтер-hook, продолжение во второй сессии по памяти
- [ ] Шаг 5. Playwright MCP: сценарий, скриншот, консоль; e2e «выдать книгу → вернуть» до зелёного
- [ ] Отчёт: `docs/about.md` (стек, правило и его проверка, навыки, 4 скриншота)
- [ ] Отчёт: README — «Как агент работает в проекте»; режим по умолчанию одной строкой
- [ ] Сделать репозиторий public (`gh repo edit --visibility public`), push, ссылка на сдачу

## Roadmap (следующие модули)

- Хранилище: SQLite + миграции вместо JSON.
- Правила: бронирование и очередь, продление, пени, блокировка должников.
- Роли: библиотекарь / читатель, авторизация.
- Интеграции: карточка книги по ISBN (Open Library), поиск, рекомендации через LLM.
- Эксплуатация: фоновое напоминание о просрочке, деплой, логи.
