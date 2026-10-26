---
last_mapped_commit: 523b7b810218d500abeddfe29445da600584b4bb
last_mapped_at: 2026-10-22
---
# Testing Patterns

**Analysis Date:** 2026-10-22

## Test Framework

**Runner:**

- Vitest 5.x (`vitest` in `devDependencies`, `package.json`)
- Config: `vite.config.ts`, `test` block: `include: ['tests/unit/**/*.test.ts']`. No separate `vitest.config.*`.
- Default environment is `node`. Browser-like code is tested with stubbed globals (see Mocking).

**E2E runner:**

- Playwright Test (`@playwright/test` 1.x)
- Config: `playwright.config.ts`: `testDir: 'tests/e2e'`, `fullyParallel: false`, `retries: 0`, single project `chromium` (Desktop Chrome), `baseURL: http://localhost:5173`, `trace` and `screenshot` on failure, `webServer` runs `npm run dev` with `reuseExistingServer: true`, `timeout: 60_000`.
- Reporter: `list` and `html` (`playwright-report/`, not committed).

**API testing:**

- `supertest` 7.x for HTTP-level tests against `createApp(...)` without listening on a port.

**Assertion Library:**

- Vitest `expect` (Jest-compatible). Playwright `expect` for web-first assertions in e2e.

**Run Commands:**

```bash
npm test                                  # Run all unit tests (vitest run)
npm run test:watch                        # Watch mode (vitest)
npx vitest run tests/unit/loans.test.ts   # Single file
npx vitest run tests/unit/loans.test.ts -t "rejects loan when reader reached the limit"  # Single test
npm run test:e2e                          # E2E, starts dev servers itself
npm run typecheck                         # tsc --noEmit (tests are included in tsconfig)
npm run check                             # typecheck + lint + format:check + unit tests; required before "done"
```

**Coverage:**

- No coverage script and no coverage provider in `package.json`. `coverage/` is in `.gitignore` and `.prettierignore`, so it is reserved for future use.

**Environment note (from `AGENTS.md`):** when the shell has HTTP proxy variables set, run npm and e2e commands as `env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY npm ...`. Otherwise `npm run test:e2e` times out in `webServer`.

## Test File Organization

**Location:**

- Unit and API tests live in a separate root directory: `tests/unit/`. They are not co-located with source.
- E2E tests live in `tests/e2e/`.
- Hook logic tests import from `.claude/hooks/` directly (`tests/unit/protect-files.test.ts`, `tests/unit/format-and-lint.test.ts`, `tests/unit/reviewer-readonly.test.ts`).

**Naming:**

- Unit: `tests/unit/<module>.test.ts`. Module maps to the source file: `loans.test.ts` → `src/domain/loans.ts`; `json-file-repository.test.ts` → `src/server/json-file-repository.ts`; `api.test.ts` → `src/server/app.ts` routes; `client-api.test.ts` → `src/client/api.ts`; `health.test.ts` → `GET /api/health`.
- E2E: `tests/e2e/<scenario>.spec.ts` (`loans.spec.ts`, `smoke.spec.ts`).

**Structure:**

```
tests/
├── unit/
│   ├── loans.test.ts                 # domain rules (pure functions)
│   ├── api.test.ts                   # HTTP API via supertest + real JsonFileRepository in tmp dir
│   ├── json-file-repository.test.ts  # storage contract on a tmp file
│   ├── health.test.ts                # smallest API test
│   ├── client-api.test.ts            # client fetch wrapper, fetch stubbed
│   ├── protect-files.test.ts         # hook decisions (pure functions)
│   ├── format-and-lint.test.ts       # hook decisions (pure functions)
│   └── reviewer-readonly.test.ts     # hook decisions (pure functions)
└── e2e/
    ├── smoke.spec.ts                 # page loads, API status shown
    └── loans.spec.ts                 # issue book → second loan refused → return
```

## Test Structure

**Suite Organization (domain, `tests/unit/loans.test.ts`):**

```typescript
import { describe, expect, it } from 'vitest';
import { availableCopies, checkoutBook, isOverdue, returnBook } from '../../src/domain/loans.js';
import type { Book, Loan, Reader } from '../../src/domain/types.js';

const now = new Date('2026-10-17T10:00:00Z');
const day = 24 * 60 * 60 * 1000;

const book: Book = {
  id: 'b1',
  title: 'Мастер и Маргарита',
  author: 'М. Булгаков',
  isbn: '978-5-17-090631-9',
  copies: 2,
};
const reader: Reader = { id: 'r1', name: 'Анна', contact: 'anna@example.com' };

// Factory with overrides: builds a Loan, tests override only the fields they care about
function loan(overrides: Partial<Loan> = {}): Loan {
  /* ... */
}

describe('checkoutBook', () => {
  it('issues loan due in 14 days', () => {
    /* ... */
  });
  it('rejects loan when reader reached the limit', () => {
    /* ... */
  });
});
```

**Patterns:**

- One `describe` per exported function (`describe('checkoutBook', ...)`, `describe('returnBook', ...)`, `describe('isOverdue', ...)`). API tests group by route: `describe('POST /api/loans', ...)`, `describe('books API', ...)`.
- Test names are English, start with a verb, and describe behavior: `it('rejects loan when no free copies left')`, `it('does not count returned loans towards the limit')`, `it('is overdue when due yesterday')`. Keep names in English (`AGENTS.md`).
- Boundary cases get their own test: limit exactly N and N+1, due at the exact instant (`not overdue exactly at the due time`), one ms after (`overdue right after the due time`).
- Assertions check the full value with `toEqual` when the shape matters (`expect(result).toEqual({ ok: false, code: 'NO_FREE_COPIES' })`). Use `toMatchObject` when only part is relevant. Refusals are asserted by `code`, not by message text.
- Immutability is tested explicitly when relevant: `it('does not mutate the original loan')`.
- Only the `it` / `describe` / `expect` / `beforeEach` / `afterEach` globals are imported explicitly from `vitest`; `globals` is not enabled.

**Setup and teardown (API tests, `tests/unit/api.test.ts`):**

```typescript
const start = new Date('2026-10-17T10:00:00Z');
const day = 24 * 60 * 60 * 1000;

let dir: string;
let now: Date;
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'library-api-'));
  now = start;
  let seq = 0;
  app = createApp({
    repo: new JsonFileRepository(join(dir, 'library.json')),
    now: () => now,
    newId: () => `id${++seq}`,
  });
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});
```

- Each test gets a fresh temp directory and a fresh app. Ids are sequential (`id1`, `id2`, ...) so assertions can check exact bodies.
- Time is moved by reassigning `now` (`now = new Date(start.getTime() + 5 * day)`). Do not use `vi.useFakeTimers()`.
- Helpers are local functions at the top of the file: `createBook(copies)`, `createReader(name)`, `checkout(bookId, readerId)`. They assert the setup step's status (`expect(res.status).toBe(201)`) before returning the id.

**Patterns:**

- Setup: build fixtures inline or with a factory function (`loan(overrides)`); no shared mutable fixtures across tests except the API `beforeEach`.
- Teardown: `afterEach` removes temp dirs with `rm(..., { recursive: true, force: true })`.
- Assertion: `expect(res.status).toBe(409); expect(res.body.code).toBe('LOAN_LIMIT_REACHED');` pair for API errors.
- Concurrency: `Promise.all([checkout(a), checkout(b)])` then check the sorted status list (`toEqual([201, 409])`).

## Mocking

**Framework:** Vitest built-ins (`vi`). No mocking library beyond that.

**Strategy in this codebase:** prefer real collaborators over mocks.

- Domain: no mocks at all. Pass plain objects.
- API: real `JsonFileRepository` writing into a temp directory. The repository interface is not mocked.
- Storage failure: a real corrupted file in the temp dir (`writeFile(file, '{ not json')`), not a mocked repository.

**Where mocks are used:**

- Global `fetch` in client tests (`tests/unit/client-api.test.ts`):
  ```typescript
  function stubFetch(response: Response | Error) {
    const fetchMock = vi.fn(() =>
      response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
    );
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });
  ```
  Responses are built with `Response.json({ code: 'NO_FREE_COPIES' }, { status: 409 })`. Stubs are removed in `afterEach`.
- Injected dependencies instead of mocks: `createApp({ repo, now, newId })` accepts clock and id generator. Use these seams rather than mocking modules.

**What to Mock:**

- Browser `fetch` in client unit tests (node environment has no server).
- Nothing else in unit tests unless a real collaborator is impossible.

**What NOT to Mock:**

- Domain rules: always call the real function.
- The repository in API tests: use the JSON file repository on a temp file.
- Express: use `supertest` against the real app from `createApp`.
- Time: pass `now` explicitly; do not stub `Date`.

## Fixtures and Factories

**Test Data:**

- Sample data is inline in each test file. Book and reader fixtures use realistic Russian values: title `Мастер и Маргарита`, author `М. Булгаков`, ISBN `978-5-17-090631-9`, reader `Анна` with `anna@example.com`.
- Dates are fixed ISO strings: `new Date('2026-10-17T10:00:00Z')`. Expected due date is written out literally (`'2026-10-31T10:00:00.000Z'`), which documents the 14-day rule in the test.
- Hook tests use a fixed root path `const root = '/home/user/library';` and `it.each([...])` tables of commands or paths.

**Location:**

- No shared fixtures directory and no factories module. Keep data next to the test that uses it.
- E2E data is generated per run: `randomUUID().slice(0, 8)` suffixes titles and names so runs do not collide (`tests/e2e/loans.spec.ts`).

**Data files:**

- Unit tests write only to `os.tmpdir()` (`mkdtemp`). Never point unit tests at `data/library.json`.
- E2E runs against the dev server's data file (`data/library.json`). Known gap: see `docs/plan.md` roadmap item about a separate e2e data file via `LIBRARY_DATA_FILE` in `playwright.config.ts`.

## Coverage

**Requirements:** None enforced. No coverage threshold in config and no coverage command.

**View Coverage:**

```bash
npx vitest run --coverage   # needs @vitest/coverage-* provider; not installed
```

Adding a coverage provider is a dependency change and needs approval (`AGENTS.md`).

## Test Types

**Unit tests (`tests/unit/`):**

- Domain rules: pure functions, fastest and most detailed. Every rule in `src/domain/loans.ts` has boundary and refusal cases.
- API tests: `supertest` against `createApp` with a real JSON file repository in a temp dir. Cover validation (`400`), not found (`404`), domain refusal (`409` with code), storage failure (`500` with code), and concurrency (`Promise.all`).
- Client API wrapper: `fetch` stubbed; verifies error-code to Russian text mapping and URL encoding.
- Storage: `json-file-repository.test.ts` tests read/write on a temp file.
- Hook logic: pure functions exported from `.claude/hooks/*.ts` and tested directly.

**Integration tests:**

- Not a separate layer. API tests with the real repository act as integration tests.

**E2E tests (`tests/e2e/`):**

- Playwright, Chromium only.
- `smoke.spec.ts`: page title heading and `API: ok` status text.
- `loans.spec.ts`: full user scenario: add book (1 copy), add reader, issue, see second loan refused via `role="alert"`, return, see status change.
- The dev server is started by `webServer` in `playwright.config.ts`. Playwright MCP is used by the agent for manual UI checks (`.mcp.json`, `@playwright/mcp@0.0.83`); MCP runs are not part of `npm test`.

## Locator Rules (E2E)

From `.claude/rules/e2e.md` (applies to `tests/e2e/**`):

- Use role and label locators: `page.getByRole('form', { name: 'Добавить книгу' })`, `getByLabel('Название')`, `getByRole('button', { name: 'Выдать' })`, `getByRole('table', { name: 'Книги' })`, `getByRole('row', { name: title })`.
- Use `getByTestId` only when no role or label exists. None is used currently.
- Forbidden: CSS and XPath selectors (`.btn`, `#id`, `//button`), `page.waitForTimeout`, any fixed sleep.
- Assertions are web-first: `await expect(locator).toContainText(...)`, `toHaveText(...)`, `toBeVisible()`. Do not read text and compare manually.
- One test = one user scenario. Name in English, describing behavior: `'issues a book to a reader and accepts it back'`.

## Common Patterns

**Async API test:**

```typescript
it('rejects loan when no free copies left', async () => {
  const bookId = await createBook(1);
  await checkout(bookId, await createReader('Анна'));

  const res = await checkout(bookId, await createReader('Борис'));

  expect(res.status).toBe(409);
  expect(res.body.code).toBe('NO_FREE_COPIES');
});
```

**Async client error test:**

```typescript
async function messageOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return errorMessage(error);
  }
  throw new Error('expected request to fail');
}

it('reports unreachable server when request fails', async () => {
  stubFetch(new TypeError('fetch failed'));
  expect(await messageOf(api.listBooks())).toBe('Сервер недоступен');
});
```

The `throw new Error('expected request to fail')` at the end guards against the test passing when no error is raised.

**Error (refusal) testing in domain:**

```typescript
it('rejects return of an already returned loan', () => {
  const returned = loan({ returnedAt: new Date(now.getTime() - day) });

  const result = returnBook({ loan: returned, now });

  expect(result).toEqual({ ok: false, code: 'LOAN_ALREADY_RETURNED' });
});
```

**Table-driven tests (hooks):**

```typescript
it.each(['.env', '.env.local', '.env.example', 'config/.env.test'])(
  'blocks writing to env file %s',
  (file) => {
    expect(checkFilePath(`${root}/${file}`)).not.toBeNull();
  },
);
```

**Storage failure testing:**

```typescript
const file = join(dir, 'corrupted.json');
await writeFile(file, '{ not json');
const broken = createApp({ repo: new JsonFileRepository(file) });
const res = await request(broken).get('/api/books');
expect(res.status).toBe(500);
expect(res.body.code).toBe('INVALID_STORAGE_FILE');
```

**Time-based testing:** move `now` forward through the injected clock; assert both sides of the boundary.

```typescript
now = new Date(start.getTime() + 14 * day);
expect((await request(app).get('/api/loans')).body[0].overdue).toBe(false);
now = new Date(start.getTime() + 15 * day);
expect((await request(app).get('/api/loans')).body[0].overdue).toBe(true);
```

## Test-First Workflow (project rule)

- Business rules in `src/domain/` and API routes in `src/server/` are written TDD: failing test first, then minimal code, then refactor (`AGENTS.md`, skill `.claude/skills/write-tests/SKILL.md`).
- Before writing code, list the cases: main scenario, boundaries (limit N / N+1, due today / yesterday / tomorrow, last free copy), refusals with codes, invalid input → `400`.
- Confirm the test fails for the right reason (assertion), not for a typo or missing import.
- Bug fix in these layers: first write a test that reproduces the bug.
- Tests must not be weakened to pass (`toBeTruthy` instead of exact value), skipped (`.skip`, `.only`, `it.todo`), or deleted to get green.

## Definition of Done

- `npm run check` is green: `typecheck` → `lint` → `format:check` → `npm test`.
- For UI changes: `npm run test:e2e` is also green.
- E2E runs in a sandbox-friendly environment may need `env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY`.
- Chromium for Playwright on WSL: one-time `npx playwright install chromium` and `sudo npx playwright install-deps chromium` (see `AGENTS.md`).

## Known Gaps

- No coverage measurement at all.
- No unit tests for React components (`src/client/*.tsx`). UI behavior is covered only by e2e (`tests/e2e/loans.spec.ts`). `client-api.test.ts` covers `src/client/api.ts` only.
- `json-file-repository.test.ts` and `api.test.ts` share the temp-dir pattern; there is no shared helper.
- E2E writes into the dev data file; isolation is planned (see `docs/plan.md` roadmap).

---

_Testing analysis: 2026-10-22_
