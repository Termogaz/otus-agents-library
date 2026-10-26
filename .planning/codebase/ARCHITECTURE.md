---
last_mapped_commit: 523b7b810218d500abeddfe29445da600584b4bb
last_mapped_at: 2026-10-22
---
<!-- refreshed: 2026-10-22 -->

# Architecture

**Analysis Date:** 2026-10-22

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                 React UI (Vite dev :5173 / build dist/client)        │
│  `src/client/App.tsx` → BooksSection / ReadersSection / LoansSection │
│  HTTP client: `src/client/api.ts`                                    │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HTTP JSON  (/api/* proxied by Vite to :3000)
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│             Express 5 API (`src/server/index.ts` :3000)              │
│  `src/server/app.ts`: routes → zod parse → domain → repo → response  │
│  per-process queue `serial()` around loan checkout/return            │
└───────────────┬───────────────────────────────────┬─────────────────┘
                │ calls pure rules                   │ via interface
                ▼                                    ▼
┌──────────────────────────────┐   ┌─────────────────────────────────────┐
│ Domain (`src/domain/`)       │   │ Repository port                      │
│ `loans.ts`: checkoutBook,    │   │ `src/server/repository.ts`           │
│ returnBook, isOverdue,       │   │ `LibraryRepository` + `StorageError` │
│ availableCopies              │   └──────────────────┬──────────────────┘
│ `types.ts`: entities         │                      │ implemented by
│ No I/O, no framework         │                      ▼
└──────────────────────────────┘   ┌─────────────────────────────────────┐
                                   │ `src/server/json-file-repository.ts` │
                                   │ one JSON file (default              │
                                   │ `data/library.json`), atomic write  │
                                   └─────────────────────────────────────┘
```

## Component Responsibilities

| Component         | Responsibility                                                                                | File                                 |
| ----------------- | --------------------------------------------------------------------------------------------- | ------------------------------------ |
| Domain rules      | Loan limit (3), loan period (14 days), free-copy check, overdue status, return rule           | `src/domain/loans.ts`                |
| Domain types      | `Book`, `Reader`, `Loan`, `LoanPolicy`, `LoanResult`, `LoanErrorCode`                         | `src/domain/types.ts`                |
| Domain barrel     | Public surface of the domain layer                                                            | `src/domain/index.ts`                |
| HTTP API          | Routes, input validation (zod), error → HTTP mapping, id and clock injection                  | `src/server/app.ts`                  |
| Repository port   | Async storage interface (books, readers, loans) and storage error class                       | `src/server/repository.ts`           |
| JSON storage      | Reads/writes the whole store file, schema check and version check, atomic rename, write queue | `src/server/json-file-repository.ts` |
| Process bootstrap | Reads `PORT` and `LIBRARY_DATA_FILE`, wires repo into app, starts listening                   | `src/server/index.ts`                |
| UI shell          | Loads all three lists, runs actions, shows error messages, health badge                       | `src/client/App.tsx`                 |
| Books UI          | Add-book form and availability table                                                          | `src/client/BooksSection.tsx`        |
| Readers UI        | Add-reader form and list                                                                      | `src/client/ReadersSection.tsx`      |
| Loans UI          | Checkout form, loans table with status, return button                                         | `src/client/LoansSection.tsx`        |
| API client        | `fetch` wrapper, maps API error codes to Russian messages                                     | `src/client/api.ts`                  |
| Client entry      | Mounts React in `#root` (StrictMode)                                                          | `src/client/main.tsx`                |

## Pattern Overview

**Overall:** Layered fullstack TypeScript monolith: a pure domain core, a thin Express HTTP layer with a repository port, and a React SPA that talks to the API over HTTP only. Dependencies point inward (`client` → HTTP → `server` → `domain`), as stated in `AGENTS.md`.

**Key Characteristics:**

- Business rules are pure functions with injected time (`now: Date`) and injected policy (`policy` defaults to `DEFAULT_LOAN_POLICY`); see `src/domain/loans.ts`.
- Expected business failures are returned as typed results (`{ ok: false, code }`), not thrown strings; the route maps them to `409` with the same code (`src/server/app.ts`).
- Storage is hidden behind `LibraryRepository` (`src/server/repository.ts`); the only implementation is `JsonFileRepository`. The interface is async so SQLite can replace it without touching routes or domain (planned, see `docs/plan.md`).
- The client has no shared state store: `App.tsx` holds all server data in `useState` and calls `refresh()` after each successful action.
- Test seams: `createApp({ repo, now, newId })` lets tests inject a repository, a clock and ids (`tests/unit/api.test.ts`, `tests/unit/json-file-repository.test.ts`).

## Layers

**Domain (`src/domain/`):**

- Purpose: business rules for loans and copies.
- Location: `src/domain/`
- Contains: pure functions (`checkoutBook`, `returnBook`, `isOverdue`, `availableCopies`), types, default policy constant.
- Depends on: nothing in the project (`src/domain/loans.ts` imports only `./types.js`).
- Used by: `src/server/app.ts` only.

**Server HTTP layer (`src/server/app.ts`, `src/server/index.ts`):**

- Purpose: translate HTTP into domain calls and persist results.
- Location: `src/server/`
- Contains: `createApp` factory, zod schemas (`bookInput`, `readerInput`, `loanInput`, `loanQuery`, `idParams`), `ApiError`, global error handler.
- Depends on: `src/domain/index.ts`, `src/server/repository.ts`, `express`, `zod`, `node:crypto`.
- Used by: `src/server/index.ts` (process entry) and tests via `createApp`.

**Repository port and adapter (`src/server/repository.ts`, `src/server/json-file-repository.ts`):**

- Purpose: persistence of `Book`, `Reader`, `Loan` records.
- Location: `src/server/`
- Contains: `LibraryRepository` interface, `StorageError` (codes `INVALID_STORAGE_FILE`, `UNSUPPORTED_STORAGE_VERSION`), `JsonFileRepository` (uses `node:fs/promises`, zod for file schema, `STORAGE_VERSION = 1`).
- Depends on: `src/domain/index.ts` (types only), `node:fs/promises`, `zod`.
- Used by: `src/server/app.ts` through the interface.

**Client (`src/client/`):**

- Purpose: single-page UI for books, readers, loans.
- Location: `src/client/`
- Contains: React components, `api.ts` HTTP client, Russian UI texts.
- Depends on: the HTTP API only (no import from `src/server/` or `src/domain/`; the client keeps its own view types in `src/client/api.ts`).
- Used by: browser via `index.html` → `src/client/main.tsx`.

## Data Flow

### Primary Request Path: check out a book

1. `LoansSection` form submit calls `onCheckout(bookId, readerId)` (`src/client/LoansSection.tsx`).
2. `App.run()` calls `api.checkout` → `POST /api/loans` (`src/client/App.tsx`, `src/client/api.ts`).
3. Vite dev server proxies `/api` to `http://localhost:3000` (`vite.config.ts`).
4. Express parses JSON and validates `{ bookId, readerId }` with `loanInput` (`src/server/app.ts`).
5. The handler enters `serial()`, loads book and reader via `repo.getBook` / `repo.getReader`; missing → `404`.
6. `repo.listLoans()` loads all loans; `checkoutBook({ loanId, book, reader, loans, now })` runs (`src/domain/loans.ts`).
7. On `{ ok: false }` the handler throws `ApiError(409, code)` → error middleware returns `{ code, details }` (`src/server/app.ts`).
8. On success `repo.saveLoan(loan)` writes the whole file through `JsonFileRepository.update` → `persist` (temp file + `rename`) (`src/server/json-file-repository.ts`); response `201` with the loan.
9. Client `run()` clears the error and calls `refresh()`, which re-fetches books, readers and loans (`src/client/App.tsx`).

### Return flow

1. `LoansSection` "Вернуть" button → `onReturn(loanId)` → `api.returnLoan` → `POST /api/loans/:id/return`.
2. Handler runs `serial()`, `repo.getLoan`, `returnBook({ loan, now })`, `repo.saveLoan`; double return → `409 LOAN_ALREADY_RETURNED`.

### Read flow

1. `GET /api/books` joins each book with `availableCopies(book, loans)` (`src/server/app.ts`).
2. `GET /api/loans` adds an `overdue` flag computed by `isOverdue(loan, now())`; status text is computed in the client (`LoansSection.status`).

**State Management:**

- Server: no in-memory cache; every operation reads the JSON file again, so several processes on the same file see each other's writes (`src/server/json-file-repository.ts` header comment).
- Client: component state only (`useState` in `App.tsx` and forms); server data is re-fetched after every mutation.

## Key Abstractions

**`LibraryRepository`:**

- Purpose: the only way the server reaches data.
- Examples: `src/server/repository.ts`, implementation `src/server/json-file-repository.ts`
- Pattern: port/adapter (interface with one adapter); `save*` means upsert by `id`.

**`LoanResult` / `LoanErrorCode`:**

- Purpose: typed success/failure of domain rules.
- Examples: `src/domain/types.ts`, `src/domain/loans.ts`
- Pattern: discriminated union `{ ok: true; loan } | { ok: false; code }`.

**`ApiError`:**

- Purpose: expected HTTP failures carrying status and code.
- Examples: `src/server/app.ts` (class defined locally, not exported)
- Pattern: thrown inside handlers, converted by the single `handleError` middleware.

**`serial()` queue (server) and `enqueue()` queue (repository):**

- Purpose: serialize checkout/return so two concurrent requests cannot take the same last copy; serialize file writes within one repository instance.
- Examples: `src/server/app.ts` (`serial`), `src/server/json-file-repository.ts` (`enqueue`)
- Pattern: promise chaining; the two queues are independent, so the guarantee holds only inside one process.

**`StorageError`:**

- Purpose: storage failures that the API reports with a stable code (HTTP 500 with `code`).
- Examples: `src/server/repository.ts`, thrown in `src/server/json-file-repository.ts`.

## Entry Points

**API server:**

- Location: `src/server/index.ts`
- Triggers: `npm start` (`tsx src/server/index.ts`), `npm run dev` (`tsx watch`) via `concurrently`.
- Responsibilities: read `PORT` (default 3000) and `LIBRARY_DATA_FILE` (default `data/library.json`), create the repo and app, listen.

**UI:**

- Location: `index.html` → `src/client/main.tsx`
- Triggers: Vite dev server on :5173 (`npm run dev`), or static `dist/client` after `npm run build` (no server-side hosting of the build is defined in the repo).
- Responsibilities: mount `App` into `#root`.

**Test entries:**

- Unit/API: `tests/unit/*.test.ts` (Vitest, `vite.config.ts` `test.include`).
- E2E: `tests/e2e/*.spec.ts` (Playwright, `playwright.config.ts`; starts `npm run dev` itself).

## Architectural Constraints

- **Threading:** single Node.js event loop. Concurrency is handled by promise queues, not worker threads.
- **Global state:** no module-level mutable singletons in `src/`. Mutable state lives per instance: `tail` in `createApp` (`src/server/app.ts`) and `queue` in `JsonFileRepository` (`src/server/json-file-repository.ts`).
- **Circular imports:** none found. The graph is `index.ts → app.ts → domain, repository.ts`; `json-file-repository.ts → repository.ts, domain`.
- **Single-writer assumption:** the file store has no lock across processes. Atomic rename protects against torn files, but two processes doing read-modify-write at the same time can lose an update. Concurrency protection exists only within one process.
- **Default policy is fixed in the domain:** `DEFAULT_LOAN_POLICY` (`src/domain/loans.ts`) is not read from config; `checkoutBook` accepts a `policy` argument but `app.ts` does not pass one.
- **Data format versioning:** `STORAGE_VERSION = 1` in `src/server/json-file-repository.ts`; any structural change needs a bump and migration (rule from `AGENTS.md`).
- **Date handling:** domain takes `now: Date`; the server injects `() => new Date()` by default (`src/server/app.ts`).
- **Build topology:** `vite build` emits only the client to `dist/client`; the API has no build step and runs through `tsx`.

## Anti-Patterns

### Whole-file reads and writes for every operation

**What happens:** `JsonFileRepository` reads and rewrites the entire store on every call, and `GET /api/books` loads all loans to compute availability (`src/server/json-file-repository.ts`, `src/server/app.ts`).
**Why it's wrong:** cost grows with data size and each write rewrites every record; this is acceptable only while data is small and is the reason for the planned SQLite move.
**Do this instead:** keep new persistence work behind `LibraryRepository` methods (add a filtered query such as `listLoans({ bookId })` rather than filtering all loans in a route). The existing `LoanFilter` already shows the pattern.

### Business rule outside the domain

**What happens:** the route handler calls `repo.listLoans()` and decides how to load data before calling `checkoutBook` (`src/server/app.ts`); the client also computes a loan status label (`src/client/LoansSection.tsx` `status`).
**Why it's wrong:** data selection is correct here (it belongs to the server), but any new rule added to the client or the route would bypass the domain tests.
**Do this instead:** put new rules in `src/domain/` as pure functions with a `now` parameter and a typed result, then call them from the route.

### Serialization queue duplicated across layers

**What happens:** `serial()` in `src/server/app.ts` and `enqueue()` in `src/server/json-file-repository.ts` both chain promises.
**Why it's wrong:** the two queues do not coordinate; the guarantee for checkout depends on the app-level queue, while the repository queue protects only file access inside one instance.
**Do this instead:** when adding a second writer path, route it through the same app-level `serial()`; when adding a DB adapter, make transactions the serialization mechanism and remove the app-level queue deliberately.

## Error Handling

**Strategy:** domain returns typed failures; the route throws `ApiError` for HTTP-level failures; one Express error middleware formats all responses.

**Patterns:**

- Input validation: `parse(schema, value)` throws `ApiError(400, 'VALIDATION_ERROR', fieldErrors)` (`src/server/app.ts`).
- Malformed JSON body: `express.json()` error with type `entity.parse.failed` is mapped to `400 INVALID_JSON` in `handleError`.
- Domain refusal: `409` with the domain code (`NO_FREE_COPIES`, `LOAN_LIMIT_REACHED`, `LOAN_ALREADY_RETURNED`).
- Missing records: `404` with `BOOK_NOT_FOUND`, `READER_NOT_FOUND`, `LOAN_NOT_FOUND`.
- Storage and unknown errors: logged with `console.error`, answered `500` with `code` (`StorageError.code` or `INTERNAL_ERROR`).
- Client: `api.ts` converts a non-OK response into `ApiError(code)`; `errorMessage()` maps codes to Russian text; `App.run()` shows it in `role="alert"`.

## Cross-Cutting Concerns

**Logging:** `console.error` in the error middleware (`src/server/app.ts`); `console.log` for the startup line (`src/server/index.ts`). No logger library.
**Validation:** zod at the server boundary (`src/server/app.ts`) and for the stored file (`src/server/json-file-repository.ts`). The client does only HTML-level `required` checks.
**Authentication:** not implemented. The API is open; there are no roles (planned in `docs/plan.md` roadmap).

---

_Architecture analysis: 2026-10-22_
