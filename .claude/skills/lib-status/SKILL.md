---
name: lib-status
description: Где мы — ветка, незакоммиченные файлы, позиция GSD из .planning/STATE.md, последние коммиты и записи docs/memory.md. Использовать в начале сессии или после /clear.
allowed-tools: Read, Grep, Bash(git branch --show-current), Bash(git status -sb), Bash(git log --oneline -5), Bash(grep -E:*), Bash(grep -m 5:*)
---

# Статус проекта

## Данные

Ветка: !`git branch --show-current`

Рабочее дерево:

!`git status -sb`

Последние коммиты:

!`git log --oneline -5`

Позиция GSD (`.planning/STATE.md`):

!`grep -E '^(Phase|Plan|Status|Last activity|Stopped at|Next):' .planning/STATE.md`

Последние записи `docs/memory.md`:

!`grep -m 5 '^## ' docs/memory.md`

## Ответ

По данным выше — коротко, не больше 12 строк:

```text
Ветка: <ветка> (<N незакоммиченных файлов или «чисто»>)
Фаза: <номер и название> — <статус>
Последний шаг: <Stopped at>
Дальше: <Next>
Коммиты: <2–3 последних, одной строкой каждый>
```

Если ветка `main` — предупреди: работа идёт только в `feat/*` / `fix/*`. Если есть незакоммиченные
файлы, не относящиеся к шагу, — назови их. Детали шага при необходимости дочитай из верхней записи
`docs/memory.md`. Ничего не меняй.
