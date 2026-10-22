---
last_mapped_commit: 523b7b810218d500abeddfe29445da600584b4bb
last_mapped_at: 2026-10-22
---
# Coding Conventions

**Analysis Date:** 2026-10-22

## Naming Patterns

**Files:**

- Server and domain modules: `kebab-case.ts`, e.g. `src/server/json-file-repository.ts`, `src/domain/loans.ts`, `src/domain/types.ts`
- React components: `PascalCase.tsx`, e.g. `src/client/LoansSection.tsx`, `src/client/App.tsx`
- Client plain modules: lowercase single word, e.g. `src/client/api.ts`, `src/client/main.tsx`
- Unit tests: `tests/unit/<module>.test.ts` (module name matches the source file, e.g. `tests/unit/json-file-repository.test.ts`)
- E2E tests: `tests/e2e/<scenario>.spec.ts`, e.g. `tests/e2e/loans.spec.ts`
- Hook scripts: `kebab-case.ts` in `.claude/hooks/`, shared helpers in `.claude/hooks/lib/`

**Functions:**

- `camelCase` verbs for domain rules: `checkoutBook`, `returnBook`, `isOverdue`, `availableCopies` (`src/domain/loans.ts`)
- Express factory: `createApp` (`src/server/app.ts`); repository class: `JsonFileRepository`
- Repository methods use `list*` / `get*` / `save*` prefixes: `listBooks`, `getLoan`, `saveLoan` (`src/server/repository.ts`)
- React components: `PascalCase` function declarations, named exports, no default exports: `export function LoansSection(...)` (`src/client/LoansSection.tsx`)
- Event handlers inside components: `submit`, `run`, `refresh` (local functions), props named `onAdd`, `onCheckout`, `onReturn`

**Variables:**

- `camelCase`; module-level constants in `UPPER_SNAKE_CASE`: `DEFAULT_LOAN_POLICY`, `DAY_MS` (`src/domain/loans.ts`), `STORAGE_VERSION` (`src/server/json-file-repository.ts`)
- Short local names for collections and callbacks are accepted in small arrow functions: `(l) => l.returnedAt === null`, `(b) => ...`
- Unused parameters are prefixed with `_` (`_req`, `_next` in `src/server/app.ts`), as required by ESLint

**Types:**

- `PascalCase` for all types, aliases and classes: `Book`, `Loan`, `LoanPolicy`, `LoanResult`, `LoanErrorCode`, `ApiError`, `StorageError`, `LibraryRepository`
- Domain entities are `type` aliases, not `interface` (`src/domain/types.ts`); the repository contract is the only `interface` (`src/server/repository.ts`)
- Client view models carry a `View` suffix: `BookView`, `LoanView`, `ReaderView` (`src/client/api.ts`)
- Error codes are `SCREAMING_SNAKE_CASE` string literal unions: `'NO_FREE_COPIES' | 'LOAN_LIMIT_REACHED' | 'LOAN_ALREADY_RETURNED'`
- Props types are local `type Props = {...}` per component file

## Code Style

**Formatting:**

- Prettier is the only formatter. Config in `.prettierrc`: `singleQuote: true`, `trailingComma: "all"`, `printWidth: 100`. Default indentation (2 spaces), semicolons on.
- Ignored by Prettier: `.prettierignore` (`dist/`, `coverage/`, `playwright-report/`, `test-results/`, `package-lock.json`, `data/`, GSD tooling).
- Run: `npm run format` (write) and `npm run format:check` (verify). Do not hand-tune style that Prettier would rewrite.
- Object literals and multi-line calls use one property per line when they wrap; short ones stay inline: `{ ok: false, code: 'NO_FREE_COPIES' }`.

**Linting:**

- ESLint flat config in `eslint.config.js`: `@eslint/js` recommended + `typescript-eslint` recommended.
- Single custom rule: `@typescript-eslint/no-unused-vars` with `argsIgnorePattern: '^_'`.
- Run: `npm run lint`. Part of `npm run check`.
- Forbidden escapes (per `AGENTS.md`): `eslint-disable`, `@ts-ignore`, `.skip` / `.only`, loosening `tsconfig.json` or `eslint.config.js`. None are present in `src/`, `tests/`, `.claude/hooks/` as of this analysis.

**TypeScript:**

- `strict: true`, plus `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters` (`tsconfig.json`). Indexed access returns `T | undefined`: check it (`const first = arr[0]; if (!first) ...`).
- No `any` in the codebase. Narrow unknown input with `zod` or type guards: `(raw as { version?: unknown } | null)?.version` in `src/server/json-file-repository.ts`.
- Use `import type { ... }` for type-only imports; `export type * from './types.js'` in `src/domain/index.ts`.
- Relative imports in `src/` and `tests/` use the `.js` extension (ESM, `moduleResolution: Bundler`): `import { checkoutBook } from '../domain/index.js';`. Client code under `src/client/` imports without extension: `from './api'`. Follow the directory's existing style.
- `readonly` on constructor parameter properties and on array inputs: `readonly Loan[]`, `constructor(readonly filePath: string)`.

**Module system:**

- `"type": "module"` in `package.json`; ESM everywhere.
- Node built-ins are imported with the `node:` prefix: `node:crypto`, `node:fs/promises`, `node:path`, `node:os`.

## Import Organization

**Order (observed in `src/server/app.ts`, `src/server/json-file-repository.ts`, `tests/unit/api.test.ts`):**

1. Node built-ins (`node:crypto`, `node:fs/promises`, `node:os`, `node:path`)
2. Third-party packages (`express`, `zod`, `supertest`, `vitest`, `react`, `@playwright/test`)
3. Project modules: domain (`../domain/index.js`), then server (`./repository.js`), tests import `../../src/...`

Separate groups with no blank lines in short files; no enforced sorting rule exists (ESLint does not sort imports).

**Path Aliases:**

- None. Use relative paths only (`tsconfig.json` has no `paths`).

## Error Handling

**Domain (`src/domain/`):**

- Expected refusals are returned as a typed result, never thrown and never returned as strings:
  ```ts
  // src/domain/loans.ts
  export type LoanResult = { ok: true; loan: Loan } | { ok: false; code: LoanErrorCode };
  if (availableCopies(book, active) === 0) {
    return { ok: false, code: 'NO_FREE_COPIES' };
  }
  ```
- Callers narrow with `if (!result.ok)` before using `result.loan`.

**Server (`src/server/app.ts`):**

- Domain refusal is converted to HTTP in the route: `if (!result.ok) throw new ApiError(409, result.code);`
- Input validation: `parse(schema, value)` helper wraps `zod` `safeParse` and throws `ApiError(400, 'VALIDATION_ERROR', fieldErrors)`.
- Not found: `throw new ApiError(404, 'BOOK_NOT_FOUND')` (also `READER_NOT_FOUND`, `LOAN_NOT_FOUND`).
- Single error middleware `handleError` (`app.use(handleError)`) maps:
  - `ApiError` → `{ code, details }` with its status
  - `express.json()` parse failure → `400 { code: 'INVALID_JSON' }`
  - `StorageError` → `500 { code: <storage code> }`
  - anything else → `console.error(error)` and `500 { code: 'INTERNAL_ERROR' }`
- Responses are always `{ code: string, ... }` on failure. Clients rely on `code`, never on message text.

**Storage (`src/server/json-file-repository.ts`):**

- Throws `StorageError` with a code from `StorageErrorCode` (`INVALID_STORAGE_FILE`, `UNSUPPORTED_STORAGE_VERSION`), defined in `src/server/repository.ts`.
- Missing file (`ENOENT`) is not an error: returns an empty store.

**Client (`src/client/api.ts`, `src/client/App.tsx`):**

- `call()` throws `ApiError(code)` for non-OK responses; non-JSON error bodies become `INTERNAL_ERROR`; network failure is a `TypeError` and maps to "Сервер недоступен".
- User-facing text comes from one place: `errorMessage(error)` with the `messages` map in `src/client/api.ts`. Add a new code there when the server gets a new code.
- Actions go through `run(action)` in `src/client/App.tsx`: success clears the error and refreshes data; failure sets `error`, shown in `<p role="alert">`. Actions return `Promise<boolean>` so forms can reset only on success (`BooksSection`).

**Hook scripts (`.claude/hooks/`):** fail closed for protected paths; decision logic lives in pure exported functions (`checkFilePath`, `checkBashCommand`, `planChecks`) so tests import them directly.

## Logging

**Framework:** `console` only. No logger library.

**Patterns:**

- Server startup: `console.log` in `src/server/index.ts` (`API: http://localhost:<port>`).
- Unexpected errors only: `console.error(error)` in the error middleware of `src/server/app.ts`. Expected refusals (409, 404, 400) are not logged.
- Do not log request bodies or the contents of the data file.

## Comments

**Language:** Russian, per `AGENTS.md`. Comments explain _why_ a rule or decision exists, not what the next line does.

**When to Comment:**

- Non-obvious business or concurrency decisions. Examples:
  - `// Нехватка экземпляров проверяется раньше лимита: это свойство книги, а не читателя` (`src/domain/loans.ts`)
  - `// Все выдачи, а не выдачи книги + выдачи читателя: в объединении общая выдача посчиталась бы дважды` (`src/server/app.ts`)
- Field meaning in types: `// null — книга ещё у читателя` (`src/domain/types.ts`)
- The first line of a file may be a one-line module summary: `// Доменный слой: чистые бизнес-правила библиотеки.` (`src/domain/index.ts`)

**JSDoc/TSDoc:**

- Not used. Types serve as documentation. Do not add JSDoc blocks.

## Function Design

**Size:** Short domain functions (10–25 lines). Route handlers in `src/server/app.ts` are 10–20 lines each; the write path is wrapped in `serial(async () => {...})`.

**Parameters:**

- Domain functions take a single object argument with named fields: `checkoutBook({ loanId, book, reader, loans, now, policy })`, `returnBook({ loan, now })`. Optional config goes last with a default (`policy = DEFAULT_LOAN_POLICY`).
- Positional arguments only for trivial single-value functions: `isOverdue(loan, now)`, `availableCopies(book, loans)`.
- Time and id generation are injected: `now: Date` in domain, `now?: () => Date` and `newId?: () => string` in `createApp` dependencies.

**Return Values:**

- Domain returns new values and never mutates inputs: `returnBook` returns `{ ...loan, returnedAt: now }`.
- Repository `save*` returns `Promise<void>`; `get*` returns `Promise<T | undefined>`; `list*` returns arrays.
- React components return JSX; async handlers return `Promise<boolean>` for success.

## Module Design

**Exports:**

- Named exports only. No default exports in `src/`.
- Domain is a barrel: `src/domain/index.ts` re-exports `./loans.js` and types. Server and tests import from `../domain/index.js` or `../../src/domain/loans.js`.

**Barrel Files:**

- Only `src/domain/index.ts`. Other directories import the module file directly (`../server/app.js`, `../client/api`).

**Layering (must hold):**

- `src/domain/` imports nothing from `server`, `client`, Express, React, `fs`, `node:fs`, `path`, `http`. Enforced by the rule file `.claude/rules/domain.md` (scoped to `src/domain/**`).
- `src/domain/` never calls `new Date()` or `Date.now()`; time arrives as `now: Date`.
- `src/server/` reaches storage only through `LibraryRepository` (`src/server/repository.ts`).
- Route shape: parse input (zod) → call domain → save through repository → respond.

## Validation

- Every external input passes a `zod` schema at the server boundary (`src/server/app.ts`: `bookInput`, `readerInput`, `loanInput`, `loanQuery`, `idParams`). Stored data is validated again on load (`storeSchema` in `src/server/json-file-repository.ts`).
- Text fields use `z.string().trim().min(1)`; counts use `z.number().int().min(1)`.
- Client forms use HTML validation (`required`, `min`, `type="number"`) and do not duplicate zod rules.

## Client (React) Patterns

- Function components with hooks; no class components, no state library.
- State lives in `App` (`src/client/App.tsx`) and is passed down as props. Sections are presentational plus local form state (`useState` in `LoansSection`).
- Forms are `<form aria-label="...">` with `<label>` wrapping inputs. Accessible names are used by tests, so keep labels and `aria-label` text stable.
- Russian UI text is written inline in JSX.
- Dates are formatted with `toLocaleDateString('ru-RU')`.

## Data Format Conventions

- Stored file is versioned: `{ version: 1, books, readers, loans }` (`STORAGE_VERSION` in `src/server/json-file-repository.ts`). Changing the structure requires bumping the version and adding a migration (`AGENTS.md`).
- Dates are ISO strings in JSON and `Date` objects in memory (`isoDate` transform).
- `copies` is a non-negative integer in storage (`storeSchema`), at least 1 on input (`bookInput`).

## Git and Commit Conventions

- Conventional Commits: type in English (`feat:`, `fix:`, `test:`, `docs:`, `chore:`), description and body in Russian. Example: `docs: добавить rules для domain и e2e`.
- Work in `feat/<name>` or `fix/<name>` branches; merge to `main` through a PR. No agent attribution lines in commits or PRs.

---

_Convention analysis: 2026-10-22_
