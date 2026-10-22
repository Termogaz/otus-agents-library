---
last_mapped_commit: 523b7b810218d500abeddfe29445da600584b4bb
last_mapped_at: 2026-10-22
---
# External Integrations

**Analysis Date:** 2026-10-22

## APIs & External Services

**Third-party APIs:**

- None. No SDK or HTTP client for an external service is imported in `src/`, `tests/`, or `.claude/hooks/`. The only `fetch` call in the application is the browser-side client in `src/client/api.ts` (calls the app's own `/api/*` routes).
- Open Library (ISBN lookup) and LLM services are on the roadmap (`docs/plan.md`, "Интеграции"), not implemented.

**Internal HTTP API (the app's own boundary):**

- Express 5 router in `src/server/app.ts`, mounted by `createApp` and started in `src/server/index.ts`
- Client: `src/client/api.ts` (`call()` wraps `fetch`, sends JSON, maps error `code` to Russian messages)
- Endpoints:
  - `GET /api/health` - liveness (`{ status: 'ok' }`)
  - `GET /api/books`, `POST /api/books` - books with computed `available` copies
  - `GET /api/readers`, `POST /api/readers`
  - `GET /api/loans` (query `bookId`, `readerId`), `POST /api/loans`, `POST /api/loans/:id/return`
- Error contract: JSON `{ code, details? }` with status 400 (`VALIDATION_ERROR`, `INVALID_JSON`), 404 (`BOOK_NOT_FOUND`, `READER_NOT_FOUND`, `LOAN_NOT_FOUND`), 409 (domain refusals such as `NO_FREE_COPIES`, `LOAN_LIMIT_REACHED`, `LOAN_ALREADY_RETURNED`), 500 (`INTERNAL_ERROR` or storage codes `INVALID_STORAGE_FILE`, `UNSUPPORTED_STORAGE_VERSION`)
- Authentication on the API: none. All routes are open to any caller that can reach the port.

**Dev proxy:**

- Vite dev server (`vite.config.ts`) proxies `/api` to `http://localhost:3000`. This is the only cross-process HTTP path in development. Hard-coded to localhost; no environment override exists.

## Data Storage

**Databases:**

- None. No database driver or ORM in `package.json`.
- Planned: SQLite with migrations (`docs/plan.md`, Roadmap); the repository interface is designed to be swapped.

**File storage (the primary store):**

- JSON file via `JsonFileRepository` in `src/server/json-file-repository.ts`, implementing `LibraryRepository` from `src/server/repository.ts`
- Default path: `data/library.json` (relative to the process working directory). Override: `LIBRARY_DATA_FILE`. Directory is created with `mkdir -p` on first write.
- File format: `{ "version": 1, "books": [...], "readers": [...], "loans": [...] }`; loans carry ISO datetime strings for `issuedAt`, `dueAt`, `returnedAt` (nullable), validated by zod on every read
- Concurrency: each repository instance serializes its own operations through a promise queue; the file is re-read on every operation so separate instances see each other's writes. Writes go to `<file>.<uuid>.tmp` and then `rename` over the target (atomic on the same filesystem). Cross-process locking is not implemented.
- Version gate: a file with a different `version` is refused with `UNSUPPORTED_STORAGE_VERSION`; there is no migration code yet (`AGENTS.md` forbids changing the data format without migration).
- Git policy: `data/*.json` is gitignored except `data/seed.json`; `data/*.tmp` ignored. Current `data/library.json` is a local runtime file.

**File tests:**

- Tests write temp files under the OS temp directory (`mkdtemp` in `tests/unit/api.test.ts`, `tests/unit/json-file-repository.test.ts`, `tests/unit/health.test.ts`) and clean up afterwards.

**Caching:**

- None.

**Shared storage for e2e:**

- E2e runs the dev server, which uses the default `data/library.json`. The roadmap item to point e2e at a separate file via `LIBRARY_DATA_FILE` in `playwright.config.ts` is not done yet (`docs/plan.md`).

## Authentication & Identity

**Auth Provider:**

- None for the application. No users, sessions, tokens, or auth middleware. Readers are domain records (`name`, `contact`), not login accounts. Roles (librarian/reader) are on the roadmap.

**Agent tooling identity:**

- Git identity is local to the developer; `.claude/settings.json` sets `attribution` for commits and PRs to empty strings (no agent attribution).

## Monitoring & Observability

**Error Tracking:**

- None (no Sentry, Bugsnag, or similar in `package.json`).

**Logs:**

- `console.error(error)` in the Express error handler (`src/server/app.ts`) for unexpected errors
- `console.log` for the startup message `API: http://localhost:<port>` (`src/server/index.ts`)
- Browser console is checked during Playwright MCP runs (favicon 404 was removed via `index.html`)
- Hook logs and audit trails are not persisted; reports go to `playwright-report/` and `test-results/` (gitignored)

**Metrics / tracing:**

- None.

## CI/CD & Deployment

**Hosting:**

- Not configured. No deployment config in the repository.

**CI Pipeline:**

- None. No `.github/workflows/` in the repository. Quality gate is local: `npm run check`, plus `npm run test:e2e` for UI changes (`AGENTS.md`).

**Source hosting:**

- GitHub: `origin` = `https://github.com/Termogaz/otus-agents-library.git` (public repository, `gh` CLI used for PRs)

**Package registry:**

- npm public registry (`https://registry.npmjs.org`, per `package-lock.json` `resolved` URLs)
- `npm publish` is denied in `.claude/settings.json`; the package is `private: true`.

## Agent and Developer Tooling Integrations

**Claude Code (project settings):**

- `.claude/settings.json`: permissions (`allow`, `ask`, `deny`), `defaultMode: acceptEdits`, hooks:
  - `PreToolUse` on `Edit|Write|Bash` -> `.claude/hooks/protect-files.ts` (blocks writes to `.env*`, `.git/`, `package-lock.json`, including via Bash)
  - `PostToolUse` on `Edit|Write` -> `.claude/hooks/format-and-lint.ts` (runs Prettier and ESLint on the edited file)
- `.claude/agents/reviewer.md`: read-only reviewer subagent; its frontmatter hook is `.claude/hooks/reviewer-readonly.ts`
- `.claude/skills/review-step/SKILL.md`, `.claude/skills/write-tests/SKILL.md`
- Hook input is validated with zod (`.claude/hooks/lib/hook-input.ts`); hooks read `CLAUDE_PROJECT_DIR`

**Playwright MCP:**

- `.mcp.json` declares server `playwright`: `npx -y @playwright/mcp@0.0.83 --browser chromium --headless`, launched with proxy variables unset. Used by the agent for browser checks and screenshots (`docs/screenshots/mcp-loan-*.png`, referenced in `docs/about.md`).

**GSD Core (local tooling):**

- `@opengsd/gsd-core@1.18.0` installed with `--claude --local` into `.claude/` (`gsd-*` files gitignored and excluded from ESLint). Not an application integration.

## Environment Configuration

**Required env vars:**

- None are required. Defaults work for local development.
- Optional: `PORT` (API port, default 3000), `LIBRARY_DATA_FILE` (data file path, default `data/library.json`)

**Set by tooling:**

- `CLAUDE_PROJECT_DIR` - provided by Claude Code to hook commands

**Secrets location:**

- No secrets are used by the application. No `.env` file exists in the repository root; `.env` and `.env.*` are gitignored and denied for agent read and write (`.claude/settings.json`, `.gitignore`). Contents were not read for this document.

## Webhooks & Callbacks

**Incoming:**

- None. The API has no webhook endpoints.

**Outgoing:**

- None. The server makes no outbound HTTP requests.

---

_Integration audit: 2026-10-22_
