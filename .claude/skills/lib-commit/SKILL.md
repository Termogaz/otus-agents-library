---
name: lib-commit
description: Коммит по правилам проекта — только не в main, после зелёного npm run check, Conventional Commits на русском, без атрибуции агента и без push.
disable-model-invocation: true
argument-hint: '[тип и суть, например: feat быстрые команды]'
allowed-tools: Read, Grep, Bash(git branch --show-current), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*), Bash(npm run check)
---

# Коммит

Подсказка к сообщению: `$ARGUMENTS` (если пусто — сформулируй по diff).

## 1. Проверить, можно ли коммитить

1. `git branch --show-current` — если `main`, **остановись**: в `main` только через Pull Request.
2. `git status --short` и `git diff` / `git diff --cached` — что войдёт в коммит.
   Нечего коммитить — так и скажи и остановись.
3. `npm run check` — если красный, **остановись** и покажи, что упало (как в `/lib-check`).

## 2. Собрать коммит

- Добавляй файлы **по именам**: `git add <путь> ...`. Не `git add -A`, не `git add .`, не `-f`.
- Не добавляй `.env*`, секреты, `package-lock.json` без согласованной смены зависимостей,
  `.local/`, служебные файлы GSD (`.planning/state.json` и подобные) — если сомневаешься, спроси.
- Изменения разного смысла (код и `docs/memory.md`, `feat` и `docs`) — разными коммитами; перед
  этим покажи пользователю план разбиения.

## 3. Сообщение

Conventional Commits: тип по-английски, описание и тело — по-русски, как в `git log`:

```text
<feat|fix|test|docs|chore>: <что сделано, со строчной, без точки>

<необязательное тело: зачем и что важно, строки до ~100 символов>
```

- Без `Co-Authored-By`, без «Generated with Claude Code» и любой другой атрибуции агента.
- Без `--no-verify` и `--amend`; не `git push` — публикует автор.
- Многострочное сообщение — через `git commit -F -` с heredoc или несколько `-m`.

## 4. Ответ

`git log --oneline -3` и одна строка: что закоммичено и что осталось незакоммиченным.
