---
last_mapped_commit: 523b7b810218d500abeddfe29445da600584b4bb
last_mapped_at: 2026-10-22
---
# Codebase Structure

**Analysis Date:** 2026-10-22

## Directory Layout

```
library/                            # project root
├── src/
│   ├── domain/                     # pure business rules and types (no I/O)
│   ├── server/                     # Express API, zod validation, JSON storage
│   └── client/                     # React + Vite UI
├── tests/
│   ├── unit/                       # Vitest: domain, API, storage, hooks
│   └── e2e/                        # Playwright Test scenarios
├── docs/                           # plan.md, memory.md, about.md, screenshots/
├── .claude/                        # agent configuration (rules, skills, hooks, agents)
│   ├── agents/                     # subagent definitions (reviewer.md)
│   ├── hooks/                      # PreToolUse/PostToolUse scripts (+ hooks/lib/)
│   ├── rules/                      # path-scoped rules (domain.md, e2e.md)
│   └── skills/                     # project skills (review-step, write-tests)
├── data/                           # runtime JSON store (created at run time, git-ignored)
├── index.html                      # Vite entry HTML
├── package.json                    # scripts and dependencies
├── tsconfig.json                   # TypeScript config
├── vite.config.ts                  # Vite (React plugin, /api proxy, Vitest include)
├── playwright.config.ts            # E2E config, starts npm run dev
├── eslint.config.js                # lint config
├── .prettierrc / .prettierignore   # formatting config
├── .mcp.json                       # Playwright MCP server for the agent
├── AGENTS.md                       # shared agent rules (imported by CLAUDE.md)
├── CLAUDE.md                       # imports AGENTS.md
└── README.md                       # run instructions and agent workflow
```

## Directory Purposes

**`src/domain/`:**

- Purpose: business rules for loans and copies; the innermost layer.
- Contains: `loans.ts` (rules), `types.ts` (entities and result types), `index.ts` (barrel).
- Key files: `src/domain/loans.ts`, `src/domain/types.ts`
- Import rule: may import nothing from the project; must not import Express, React, `fs`, or `src/server` / `src/client` (`.claude/rules/domain.md`).

**`src/server/`:**

- Purpose: HTTP boundary and persistence.
- Contains: `index.ts` (process entry), `app.ts` (`createApp` with routes), `repository.ts` (port), `json-file-repository.ts` (adapter).
- Key files: `src/server/app.ts`, `src/server/json-file-repository.ts`
- Import rule: may import `src/domain`; the adapter is the only file in `src/server` that imports `node:fs`.

**`src/client/`:**

- Purpose: browser UI.
- Contains: `main.tsx` (mount), `App.tsx` (state and layout), one `*Section.tsx` per entity area, `api.ts` (HTTP client and error messages).
- Key files: `src/client/App.tsx`, `src/client/api.ts`, `src/client/LoansSection.tsx`
- Import rule: talks to the server only through `api.ts`; does not import `src/domain` or `src/server`.

**`tests/unit/`:**

- Purpose: fast tests for domain rules, API routes (supertest), the storage adapter, the client API wrapper, and `.claude/hooks`.
- Contains: `*.test.ts`
- Key files: `tests/unit/loans.test.ts`, `tests/unit/api.test.ts`, `tests/unit/json-file-repository.test.ts`, `tests/unit/client-api.test.ts`, `tests/unit/health.test.ts`, `tests/unit/protect-files.test.ts`, `tests/unit/format-and-lint.test.ts`, `tests/unit/reviewer-readonly.test.ts`

**`tests/e2e/`:**

- Purpose: user-level scenarios in a browser.
- Contains: `loans.spec.ts` (checkout → return), `smoke.spec.ts`.
- Key files: `tests/e2e/loans.spec.ts`

**`docs/`:**

- Purpose: course deliverables and project memory.
- Contains: `plan.md` (roadmap and steps), `memory.md` (session notes), `about.md` (report), `screenshots/*.png`.
- Generated: no. Committed: yes.

**`.claude/`:**

- Purpose: configuration of the coding agent, not application code.
- Contains: `settings.json` (permissions, hooks), `rules/`, `skills/`, `agents/`, `hooks/`.
- Note: GSD Core tooling files (`.claude/gsd-*`, `agents/gsd-*`, `skills/gsd-*`, `commands/gsd*`) are installed locally and git-ignored; they are excluded from this map.

**`data/` (runtime):**

- Purpose: default location of the JSON store `data/library.json`.
- Generated: yes, by the first write. Committed: no (`data/*.json` in `.gitignore`; `data/seed.json` is allowed by the ignore rule but is not present in the repository).

**`dist/` (build output):**

- Purpose: `vite build` output in `dist/client`.
- Generated: yes. Committed: no.

## Key File Locations

**Entry Points:**

- `src/server/index.ts`: API process start (reads `PORT`, `LIBRARY_DATA_FILE`).
- `index.html` and `src/client/main.tsx`: browser entry.

**Configuration:**

- `package.json`: scripts (`dev`, `test`, `test:e2e`, `lint`, `typecheck`, `check`), engines `node >= 22`.
- `tsconfig.json`: TypeScript strict configuration.
- `vite.config.ts`: dev port 5173, `/api` proxy to `http://localhost:3000`, Vitest include path.
- `playwright.config.ts`: E2E base URL, `webServer` = `npm run dev`.
- `eslint.config.js`, `.prettierrc`, `.prettierignore`: lint and format.
- `.mcp.json`: Playwright MCP server.
- `.claude/settings.json`: agent permissions and hooks.

**Core Logic:**

- `src/domain/loans.ts`: `checkoutBook`, `returnBook`, `isOverdue`, `availableCopies`, `DEFAULT_LOAN_POLICY`.
- `src/server/app.ts`: all HTTP routes.
- `src/server/json-file-repository.ts`: storage format and writes.

**Testing:**

- `tests/unit/loans.test.ts`: domain rules.
- `tests/unit/api.test.ts`: API routes.
- `tests/e2e/loans.spec.ts`: UI flow.

## Naming Conventions

**Files:**

- Source modules: `kebab-case.ts` (`json-file-repository.ts`, `format-and-lint.ts`), per `AGENTS.md`.
- React components: `PascalCase.tsx` (`BooksSection.tsx`, `App.tsx`), per `AGENTS.md`.
- Exception: `api.ts`, `main.tsx`, `index.ts` are lowercase single words.
- Tests: `tests/unit/<module>.test.ts` (`loans.test.ts` for `src/domain/loans.ts`); e2e `*.spec.ts`.
- Agent docs: `.claude/rules/<area>.md`, `.claude/skills/<name>/SKILL.md`.

**Directories:**

- Source layers: lowercase single words (`domain`, `server`, `client`).
- Test layers: `unit`, `e2e`.

**Identifiers:**

- Types and classes: `PascalCase` (`LibraryRepository`, `JsonFileRepository`, `ApiError`).
- Functions and variables: `camelCase` (`checkoutBook`, `createApp`, `serial`).
- Constants: `UPPER_SNAKE_CASE` (`DEFAULT_LOAN_POLICY`, `STORAGE_VERSION`, `DAY_MS`).
- Error and domain codes: `UPPER_SNAKE_CASE` strings (`NO_FREE_COPIES`, `LOAN_LIMIT_REACHED`).
- Imports within `src/` use explicit `.js` suffixes in `src/server` and `src/domain` (NodeNext style); `src/client` imports omit it.

## Where to Add New Code

**New business rule (loan limit, period, copy availability, fines):**

- Primary code: `src/domain/loans.ts` (or a new `src/domain/<topic>.ts`, re-exported from `src/domain/index.ts`)
- Types: `src/domain/types.ts`
- Tests first: `tests/unit/<topic>.test.ts` (for example `tests/unit/loans.test.ts`)

**New API endpoint:**

- Route and zod schema: `src/server/app.ts` (add a schema next to `bookInput` / `loanInput`)
- Repository method if data access is new: `src/server/repository.ts` (interface) and `src/server/json-file-repository.ts` (implementation)
- Tests: `tests/unit/api.test.ts` (supertest, using `createApp` with an injected repo)

**New storage backend (SQLite):**

- Implementation: a new file in `src/server/` implementing `LibraryRepository`, e.g. `src/server/sqlite-repository.ts`
- Wiring: `src/server/index.ts`
- Tests: `tests/unit/` next to `json-file-repository.test.ts` with the same interface contract

**New UI section or component:**

- Component: `src/client/<Entity>Section.tsx` (PascalCase), wired in `src/client/App.tsx`
- API call: add a method to `api` in `src/client/api.ts`; add error text to `messages` there
- E2E: `tests/e2e/<scenario>.spec.ts`, locators by role and label (`.claude/rules/e2e.md`)

**New shared client helper:**

- Location: `src/client/` (module next to its user); there is no `utils` directory yet.

**Utilities (server or domain):**

- Pure helpers belong in `src/domain/`; HTTP-only helpers in `src/server/app.ts` (currently `parse`).

**New agent hook or rule:**

- Hook: `.claude/hooks/<name>.ts` with test in `tests/unit/<name>.test.ts`
- Rule: `.claude/rules/<area>.md` with `paths:` frontmatter

## Special Directories

**`data/`:**

- Purpose: runtime JSON store.
- Generated: yes (by the server on first write).
- Committed: no.

**`dist/`:**

- Purpose: client build output.
- Generated: yes (`npm run build`).
- Committed: no.

**`node_modules/`:**

- Purpose: npm dependencies.
- Generated: yes (`npm ci`).
- Committed: no.

**`test-results/`, `playwright-report/`, `playwright/.cache/`, `.playwright-mcp/`:**

- Purpose: Playwright and MCP artifacts.
- Generated: yes.
- Committed: no.

**`.planning/`:**

- Purpose: GSD planning artifacts, including this codebase map (`.planning/codebase/`).
- Generated: yes (by GSD commands).
- Committed: per GSD configuration.

---

_Structure analysis: 2026-10-22_
