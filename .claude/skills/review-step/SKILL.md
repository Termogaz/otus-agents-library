---
name: review-step
description: Ревью шага перед PR — изменения ветки против main по чек-листу AGENTS.md, с запуском проверок. Только отчёт, без правок.
disable-model-invocation: true
argument-hint: '[база для сравнения, по умолчанию main]'
context: fork
agent: reviewer
allowed-tools: Read, Grep, Glob, Bash(git diff:*), Bash(git log:*), Bash(git status:*), Bash(npm run check), Bash(env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY npm run test:e2e)
---

# Ревью шага

База сравнения: `$ARGUMENTS` (если пусто — `main`).

## 1. Собрать изменения

```bash
git status --short
git log --format='%h %s%n%b' <база>..HEAD
git diff <база>...HEAD --stat
git diff <база>...HEAD
```

Если изменений нет — так и напиши и остановись.

## 2. Чек-лист по `AGENTS.md`

Проверь каждый пункт только на изменённых файлах:

1. **Слои.** `src/domain/` не импортирует `express`, `react`, `fs`, `path`, `src/server/`, `src/client/`.
   Бизнес-правила не живут в маршрутах и компонентах.
2. **Граница server.** Внешний вход проверяется zod-схемой; маршрут: разобрать → домен → сохранить → ответить.
3. **Отказы домена.** Типизированный результат или ошибка с `code`, не строка; API отвечает `4xx` с кодом.
4. **Время.** В правилах нет `new Date()` / `Date.now()` — только параметр `now: Date`.
5. **Типы.** Нет `any`, `@ts-ignore`, `eslint-disable`; `tsconfig.json` и ESLint не ослаблены.
6. **Тесты.** Новое правило покрыто тестом в `tests/unit/`; нет `.skip`/`.only`; тесты не ослаблены
   и не переписаны под код. Имена тестов — на английском, о поведении.
7. **E2E** (если менялись `tests/e2e/`): нет `waitForTimeout`, CSS/XPath-селекторов; локаторы по роли.
8. **Именование и язык.** Файлы `kebab-case.ts`, компоненты `PascalCase.tsx`; тексты UI и комментарии — на русском.
9. **Защищённое.** Не тронуты `.env*`, `package-lock.json` вручную; новые зависимости — только если согласованы.
10. **Коммиты.** Conventional Commits, описание на русском, без `Co-Authored-By` и атрибуции агента.
11. **План.** Шаг отмечен в `docs/plan.md`.

## 3. Запустить проверки

```bash
npm run check
```

Если в diff есть `src/client/` или `tests/e2e/` — ещё:

```bash
env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY npm run test:e2e
```

## 4. Отчёт

```text
## Ревью: <ветка> против <база>

Проверки: npm run check — ✅/❌; e2e — ✅/❌/не требуется

### Блокеры
- `файл:строка` — что не так → как исправить

### Замечания
- ...

### Ок
- пункты чек-листа, которые пройдены
```

Блокер — нарушение `AGENTS.md` или красная проверка. Замечание — всё остальное. Файлы не меняй.
