---
paths:
  - 'tests/e2e/**'
---

# Правила для `tests/e2e/`

E2E-тесты на Playwright Test проверяют сценарии так, как их видит пользователь.

## Запрещено

- `page.waitForTimeout(...)` и любые фиксированные паузы (`setTimeout`, `sleep`).
- CSS- и XPath-селекторы: `page.locator('.btn')`, `'#id'`, `'div > span'`, `'//button'`.
- `.skip`, `.only`, `test.fixme` — чтобы тест «прошёл».

## Как писать

- Локаторы по роли и тексту: `getByRole('button', { name: 'Выдать' })`, `getByLabel`,
  `getByText`; `getByTestId` — только если у элемента нет доступной роли или подписи.
- Ожидания — web-first: `await expect(locator).toBeVisible()`, `toHaveText(...)`;
  Playwright сам дожидается состояния.
- Один тест — один пользовательский сценарий; имя теста на английском, описывает поведение.
- Тексты интерфейса в локаторах — на русском, как в UI.
