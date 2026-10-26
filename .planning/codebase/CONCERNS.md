---
last_mapped_commit: 523b7b810218d500abeddfe29445da600584b4bb
last_mapped_at: 2026-10-22
---
<!-- refreshed: 2026-10-22 -->

# Codebase Concerns

**Analysis Date:** 2026-10-22

## Tech Debt

**JSON-file storage is a whole-file read/write on every operation:**

- Issue: `JsonFileRepository` re-reads and re-validates the entire `data/library.json` on every `list*`/`get*`, and rewrites the whole file on every `save*`. `GET /api/books` calls `listBooks()` and `listLoans()`, each a full file load.
- Files: `src/server/json-file-repository.ts`, `src/server/app.ts`
- Impact: Latency and CPU grow linearly with total records; writes are O(file size). Acceptable for a teaching dataset, not for real use.
- Fix approach: Planned move to SQLite behind the existing `LibraryRepository` interface (see `docs/plan.md` roadmap). Until then, keep the interface stable so `app.ts` does not change.

**No update or delete operations in the API and repository:**

- Issue: `LibraryRepository` exposes only `save*` (upsert by id) and `list*`/`get*`. `POST /api/books` always creates a new book; there is no way to correct a typo, change `copies`, or retire a book/reader.
- Files: `src/server/repository.ts`, `src/server/app.ts` (routes `/api/books`, `/api/readers`)
- Impact: Data entry mistakes can only be fixed by hand-editing the JSON file, which is exactly the kind of manual write the project wants to avoid. Write-off of lost copies is impossible; `availableCopies` clamps to 0 (`src/domain/loans.ts`), which hides an inconsistent `copies` value instead of surfacing it.
- Fix approach: Add `PUT/PATCH /api/books/:id` and `/api/readers/:id` with zod validation, and a domain rule for lowering `copies` below the number of active loans.

**Domain policy is hard-coded and not validated against existing data:**

- Issue: `DEFAULT_LOAN_POLICY = { loanLimit: 3, loanDays: 14 }` in `src/domain/loans.ts`; `createApp` never passes a policy, so the `policy` parameter of `checkoutBook` is unused in production.
- Files: `src/domain/loans.ts`, `src/server/app.ts`
- Impact: Changing the rule means a code change and redeploy. Loans issued under an old policy keep their `dueAt`, which is correct, but nothing documents this.
- Fix approach: Keep the policy in config when the rules roadmap item (queues, renewal, fines) is started; add a test per policy source.

**Client-side layout is a single flat component tree with no data layer:**

- Issue: `src/client/App.tsx` holds all state and calls `refresh()` (three requests) after every action. There is no caching, no optimistic update, and no loading state.
- Files: `src/client/App.tsx`, `src/client/api.ts`
- Impact: Each action refetches all books, readers and loans; double-clicking a submit button sends two requests (the second is rejected by the server with `NO_FREE_COPIES` or `LOAN_LIMIT_REACHED` and shown as an error, even though the first succeeded).
- Fix approach: Disable submit buttons while a request is in flight; move to a query library only if the data grows.

**Production run path does not serve the client:**

- Issue: `npm run build` writes the client to `dist/client` (`vite.config.ts`), but `npm start` runs only `src/server/index.ts`, which serves the API and no static files. The app is only runnable through the Vite dev server with its `/api` proxy.
- Files: `package.json` (scripts `build`, `start`), `vite.config.ts`, `src/server/index.ts`
- Impact: There is no working deployment artifact; the roadmap item "деплой" starts from nothing.
- Fix approach: Serve `dist/client` from Express in production (`express.static` plus SPA fallback) or document the gap explicitly in README.

**Dev and e2e share one data file:**

- Issue: `playwright.config.ts` starts `npm run dev` with `reuseExistingServer: true`, so e2e writes into the same `data/library.json` the developer uses. The server already reads `LIBRARY_DATA_FILE`, but the test config does not set it. `tests/e2e/loans.spec.ts` works around this with random titles instead of isolation.
- Files: `playwright.config.ts`, `tests/e2e/loans.spec.ts`, `src/server/index.ts`
- Impact: Test data accumulates in the working library; a green e2e run can leave the dev data in a state the developer did not expect.
- Fix approach: Already on the roadmap: pass `LIBRARY_DATA_FILE` to the `webServer` env and use a dedicated file under `data/` or a temp directory.

**`.gitignore` promises a seed file that does not exist:**

- Issue: `.gitignore` says "коммитим только data/seed.json" (`!data/seed.json`), but no `data/seed.json` is tracked and `data/` contains only the ignored `library.json`.
- Files: `.gitignore`, `data/` (not tracked)
- Impact: A fresh clone starts with an empty library and no sample data for manual checks.
- Fix approach: Either add `data/seed.json` or remove the exception and the comment.

## Known Bugs

**Refresh failure after a successful action reports an error and keeps the form filled:**

- Symptoms: `App.run()` calls `action()` and then `refresh()` inside one `try`. If the action succeeds but the follow-up `refresh()` fails (network blip, API restart), `run` sets the error to "Сервер недоступен" and returns `false`. `BooksSection` and `ReadersSection` reset the form only when `true`, so the user sees an error and the same data still in the form.
- Files: `src/client/App.tsx` (`run`), `src/client/BooksSection.tsx`, `src/client/ReadersSection.tsx`
- Trigger: Submit a new book or reader while the API becomes unreachable between the POST and the refresh GET.
- Workaround: Reload the page and check whether the record exists before resubmitting; otherwise a duplicate book or reader is created.

**No duplicate detection for books or readers:**

- Symptoms: Submitting the same ISBN twice creates two separate book records, each with its own copies. Readers with the same name and contact can be created repeatedly.
- Files: `src/server/app.ts` (`bookInput`, `readerInput`), `src/domain/types.ts`
- Trigger: Submit the same form twice. The API returns `201` both times.
- Workaround: None in the UI. Validation of ISBN format is also absent (`isbn` is only `min(1)` text).

**Unlimited request string lengths and copy counts:**

- Symptoms: `title`, `author`, `isbn`, `name`, `contact` have no max length; `copies` has no upper bound (`src/server/app.ts`). A single request can store up to the 100 KB JSON body limit of `express.json()`, and copies can be set to any integer.
- Files: `src/server/app.ts`
- Trigger: `POST /api/books` with `copies: 1000000000` or a 90 KB title.
- Workaround: None.

**Persistence is not safe across processes:**

- Symptoms: The write queue lives in each `JsonFileRepository` instance and each `createApp` instance (`serial` in `src/server/app.ts`). Two server processes on the same `LIBRARY_DATA_FILE` (for example `npm run dev` plus a manually started `npm start`, or a dev server plus the e2e `webServer` run in parallel) each read-modify-write the file without coordination, so one process can silently overwrite another's change.
- Files: `src/server/json-file-repository.ts` (`enqueue`, `persist`), `src/server/app.ts` (`serial`)
- Trigger: Two processes with the same data file; the code comment in `json-file-repository.ts` ("несколько экземпляров видят изменения друг друга") is accurate for reads only.
- Workaround: Run one API process per data file. The `serial` queue covers the concurrent-checkout case within one process (see `tests/unit/api.test.ts`).

**Multi-call reads are not a consistent snapshot:**

- Symptoms: `GET /api/books` runs `listBooks()` and `listLoans()` as separate queued reads. A write can land between them, so the `available` count may come from a state that never existed as a whole.
- Files: `src/server/app.ts` (`app.get('/api/books')`)
- Trigger: Concurrent checkout during a books list request. Minor in effect because the next refresh corrects it.
- Workaround: None needed for the current use; resolved by the SQLite move.

**Overdue status is computed from the server clock at read time only:**

- Symptoms: `overdue` is computed in `GET /api/loans` only (`src/server/app.ts`). `GET /api/books` does not return overdue information, and nothing persists it, so any consumer that stores loan views would see stale status.
- Files: `src/server/app.ts`, `src/domain/loans.ts` (`isOverdue`)
- Trigger: Not a defect today; becomes one when fines or reminders are added.
- Workaround: Always recompute from `dueAt` and `returnedAt`.

## Security Considerations

**No authentication or authorization on any endpoint:**

- Risk: Anyone who can reach the API can add books and readers, check out and return loans. Reader contact data is returned by `GET /api/readers` without any access control.
- Files: `src/server/app.ts`, `src/server/index.ts`
- Current mitigation: Local development only; the README and `docs/plan.md` put roles and authorization in the roadmap.
- Recommendations: Do not expose the server publicly before the roles roadmap item; if it must be reachable, add authentication before any deployment.

**API listens on all network interfaces by default:**

- Risk: `createApp(...).listen(port)` in `src/server/index.ts` binds to `0.0.0.0` (no host argument), so the unauthenticated API (including reader contacts) is reachable from the local network, not only from `localhost`.
- Files: `src/server/index.ts`
- Current mitigation: None; the Vite dev server binds to `localhost` by default, but the API does not.
- Recommendations: Pass `'127.0.0.1'` as the host unless LAN access is intended; document the choice.

**Internal storage error codes and file paths reach the server log:**

- Risk: `handleError` in `src/server/app.ts` logs the full error with `console.error`, and `StorageError` messages include the absolute data file path. The response carries only the code, which is acceptable, but logs may be collected elsewhere later.
- Files: `src/server/app.ts` (`handleError`), `src/server/json-file-repository.ts` (`StorageError` messages)
- Current mitigation: Responses contain codes only; no stack traces are sent to the client.
- Recommendations: Keep stack traces out of responses (current behavior) and avoid putting personal data (reader names, contacts) into error messages when logging is introduced.

**Agent permission rules are prefix-based and can be bypassed:**

- Risk: `.claude/settings.json` denies `Bash(cat .env*)`, `Bash(head .env*)`, `Bash(tail .env*)`, which match only the literal prefix. `cat ./.env`, `grep x .env`, `less .env`, `git add -f .env` (`Bash(git add:*)` is allowed), and `git push origin HEAD:main` are not covered by these prefixes. The `reviewer` hook (`.claude/hooks/reviewer-readonly.ts`) allows `cat`, `head`, `tail` on any path, so the subagent can read `.env` through a relative path.
- Files: `.claude/settings.json`, `.claude/agents/reviewer.md`, `.claude/hooks/reviewer-readonly.ts`, `.claude/hooks/protect-files.ts`
- Current mitigation: `Read(./.env*)` deny covers the Read tool; `protect-files` blocks writes to `.env*` (including through Bash redirects and `tee`, `cp`, `sed -i`). Both are heuristics, as `docs/about.md` acknowledges.
- Recommendations: Add `Read(**/.env*)` and `Bash(* .env*)`-style patterns where Claude Code supports them, deny `git add -f`, and treat secret-file reads in `reviewer-readonly.ts` as a deny case (match on basename `.env*`, not only the literal path).

**Fail-open protection when hook dependencies are missing:**

- Risk: All PreToolUse hooks run `"$CLAUDE_PROJECT_DIR"/node_modules/.bin/tsx ...`. If `node_modules` is absent (fresh clone before `npm ci`, or a failed install), `tsx` cannot start. As recorded in `docs/memory.md`, a launch error (not exit code 2) does not block the tool call, so `protect-files` and `reviewer-readonly` silently stop protecting.
- Files: `.claude/settings.json` (`hooks`), `.claude/agents/reviewer.md`, `.claude/hooks/protect-files.ts`
- Current mitigation: `npm ci` is required before work; `protect-files` fails closed only when it runs and cannot parse its input.
- Recommendations: Add a session-start check in the project's first step or document `npm ci` as a hard prerequisite in `CLAUDE.md`.

**Agent can edit its own configuration:**

- Risk: `permissions.deny` covers `Edit(./.env*)` and `Edit(./package-lock.json)` only. `.claude/settings.json`, `.claude/hooks/*.ts`, and `.claude/agents/*.md` are not protected, and the default mode is `acceptEdits`. A session could weaken its own permissions or remove hooks, and the change would apply to later sessions.
- Files: `.claude/settings.json`, `.claude/hooks/`, `.claude/agents/`
- Current mitigation: Changes to these files are visible in git diff and reviewed by `/review-step`; nothing blocks them at runtime.
- Recommendations: Add `Edit(./.claude/**)` to `ask` (or `deny` for `settings.json`) and extend `protect-files` to those paths, so changes require explicit approval.

**Unpinned npx download at MCP start:**

- Risk: `.mcp.json` runs `npx -y @playwright/mcp@0.0.83`, which downloads and runs a package at session start. The version is pinned, but `-y` skips confirmation and the package is fetched from the registry each time the cache is empty.
- Files: `.mcp.json`
- Current mitigation: Exact version pin.
- Recommendations: Pin via `package.json` devDependencies and call the local binary, so the version goes through the normal lockfile and dependency-approval rule in `AGENTS.md`.

**Git commit to `main` is only forbidden by a soft rule:**

- Risk: `Bash(git commit:*)` and `Bash(git add:*)` are in `allow`. The rule "в main только через Pull Request" lives in `AGENTS.md` only; there is no `Bash` deny for committing on `main` (`--no-verify` also bypasses git hooks, which are not configured in this repo anyway).
- Files: `.claude/settings.json`, `AGENTS.md`
- Current mitigation: `docs/memory.md` and the `/review-step` checklist.
- Recommendations: Add a `PreToolUse` check that refuses `git commit` when `git branch --show-current` is `main`.

## Performance Bottlenecks

**Full-file JSON load on every request:**

- Problem: Every API call parses and validates the whole store (`load()` in `src/server/json-file-repository.ts`). `POST /api/loans` loads loans twice (`getBook`/`getReader` load the file, then `listLoans` loads it again) and writes the full file on success.
- Files: `src/server/json-file-repository.ts`, `src/server/app.ts` (`POST /api/loans`)
- Cause: Storage design (single JSON file, no index).
- Improvement path: Replace with SQLite and indexed queries; short term, cache the parsed store inside the repository and invalidate on write.

**Global serialization of all loan writes:**

- Problem: `serial()` in `src/server/app.ts` queues every checkout and return across all books and readers, and each queued task performs a full file read and write.
- Files: `src/server/app.ts`
- Cause: The queue is intentionally global to prevent double issue of the last copy; it is correct but serializes unrelated operations.
- Improvement path: Keep correctness; if throughput matters, scope the queue per book id, which requires the SQLite transaction model.

**No pagination on list endpoints:**

- Problem: `GET /api/books`, `/api/readers`, `/api/loans` return all records; the client renders them all.
- Files: `src/server/app.ts`, `src/client/BooksSection.tsx`, `src/client/LoansSection.tsx`
- Cause: No limit parameters; fine at dozens of records.
- Improvement path: Add `limit`/`offset` with defaults when the dataset grows.

## Fragile Areas

**Protected-file heuristics in the Bash parser:**

- Files: `.claude/hooks/lib/shell.ts`, `.claude/hooks/protect-files.ts`
- Why fragile: The parser does not expand `$VAR`, `$(...)`, backticks, aliases, or `python -c` strings (`docs/memory.md` notes this). `protectedReason` matches any basename starting with `.env`, so it also blocks `.envrc` and similar names, while `sed -i` detection (`/^-[a-zA-Z]*i/`) can misfire on unrelated flags.
- Safe modification: Add a test in `tests/unit/protect-files.test.ts` for every new bypass or false positive before changing the parser. The existing heredoc stripping came from a false positive; keep that test.
- Test coverage: Covered by `tests/unit/protect-files.test.ts` and `tests/unit/reviewer-readonly.test.ts`; the bypass cases above have no tests.

**Hard-coded storage version without a migration path:**

- Files: `src/server/json-file-repository.ts` (`STORAGE_VERSION = 1`)
- Why fragile: The comment says "при изменении структуры — повысить и добавить миграцию", but no migration function exists; any future bump makes every existing file unreadable (`UNSUPPORTED_STORAGE_VERSION`, HTTP 500 on every request).
- Safe modification: Add a `migrate(raw, from, to)` step before the schema check in `load()` in the same change as the version bump; AGENTS.md requires migrating existing data.
- Test coverage: `tests/unit/json-file-repository.test.ts` checks rejection of version 2 but not an upgrade path (none exists).

**Atomic write without fsync and with leftover temp files:**

- Files: `src/server/json-file-repository.ts` (`persist`)
- Why fragile: The write goes to `<file>.<uuid>.tmp` and is renamed over the target, which is atomic on the same filesystem, but there is no `fsync` before rename, so a power loss can leave an empty or partial file after rename on some filesystems. If `writeFile` fails, the temp file is not removed.
- Safe modification: Use `fs.promises.open` + `handle.sync()` before `rename`, and delete the temp file in a `finally` on failure. Keep the file at `data/` on the same filesystem.
- Test coverage: No test simulates a failed write or a leftover temp file.

**Storage file is not validated at startup:**

- Files: `src/server/index.ts`, `src/server/json-file-repository.ts`
- Why fragile: A corrupt or wrong-version `library.json` is detected only on the first request, which returns 500 with a code. The server starts and reports `API: http://localhost:3000` normally.
- Safe modification: Call `repo.listBooks()` once before `listen`, or validate in `index.ts` and exit with a message.
- Test coverage: Rejection is tested in `tests/unit/json-file-repository.test.ts`; startup behavior is not tested.

**Relative default data path depends on the working directory:**

- Files: `src/server/index.ts` (`LIBRARY_DATA_FILE ?? 'data/library.json'`)
- Why fragile: Starting the server from another directory creates a new empty library in that directory; no warning is shown.
- Safe modification: Resolve the default relative to the project root (`import.meta.url`) and log the resolved path at startup.

## Scaling Limits

**Single JSON file storage:**

- Current capacity: Not measured. Test data in `data/library.json` is about 7 KB (about 30 records); every operation scales with that size.
- Limit: Practical limit is reached when reads become noticeable (order of thousands of records, to be measured) and when concurrent processes are needed.
- Scaling path: SQLite behind `LibraryRepository` (roadmap item), then a server database if deployed.

**Single-process write serialization:**

- Current capacity: One API process; all loan writes go through one in-memory queue.
- Limit: Cannot run multiple API instances; the queue does not coordinate across processes.
- Scaling path: Database transactions with a unique constraint on active copies, instead of the in-process queue.

## Dependencies at Risk

**Recent major versions of build and test tooling:**

- Package: `typescript ^6.0.3`, `vite ^8.3.4`, `vitest ^5.0.5`, `eslint ^10.13.0`, `@types/node ^26.6.5`, `@playwright/test ^1.64.1` (`package.json`)
- Risk: These majors are new relative to most ecosystem plugins and tutorials; plugin compatibility (`@vitejs/plugin-react ^6.1.2`, `typescript-eslint ^8.71.2`) and the `engines` field (`node >=22`) are not verified by any CI.
- Impact: A future `npm ci` on a different machine or lockfile regeneration can break builds or lint; the tooling would then be hard to debug for a learner.
- Migration plan: Keep `package-lock.json` as the source of truth, run `npm run check` after any upgrade, and record upgrade decisions in `docs/memory.md`.

**`@opengsd/gsd-core` installed locally by version pin:**

- Package: `@opengsd/gsd-core@1.18.0` (installed with `npx ... --claude --local`, files under `.claude/gsd-*` and ignored by git and ESLint)
- Risk: Tooling files are outside git and outside lint; a reinstall with a different version changes the hooks in `.claude/settings.local.json` without a review.
- Impact: Changes to agent behavior can happen outside the commit history.
- Migration plan: Record the installed version in `docs/memory.md` when it changes; the restore command in `AGENTS.md` pins it.

## Missing Critical Features

**No authentication, roles, or audit trail:**

- Problem: No user identity exists. Loans are not attributed to the staff member who made them.
- Blocks: Roles roadmap item (librarian vs reader), any production use.

**No CI pipeline:**

- Problem: There is no `.github/workflows` directory. `npm run check` (`typecheck`, `lint`, `format:check`, `test`) and the e2e run are enforced only by the agent's process and the `/review-step` checklist.
- Blocks: Automatic verification of PRs; a broken `main` is possible if a change skips the checks.

**No health check of storage:**

- Problem: `GET /api/health` returns `{ status: 'ok' }` without touching the repository, so it reports healthy even when the data file is corrupt (`tests/unit/health.test.ts` asserts this on purpose).
- Blocks: Monitoring and deployment checks.

## Test Coverage Gaps

**Client components are not unit-tested:**

- What's not tested: `App.run()` error paths, the refresh-after-action bug above, form reset behavior, and the loan status labels in `LoansSection.tsx` (`На руках`, `Просрочена`, `Возвращена`). Only `api.ts` has a unit test (`tests/unit/client-api.test.ts`).
- Files: `src/client/App.tsx`, `src/client/BooksSection.tsx`, `src/client/ReadersSection.tsx`, `src/client/LoansSection.tsx`
- Risk: UI regressions are caught only by the single e2e scenario in `tests/e2e/loans.spec.ts`, which does not check overdue display or the error state after a failed refresh.
- Priority: Medium

**Storage failure paths are not tested end to end:**

- What's not tested: A failed `writeFile` or `rename` (leftover temp file), a corrupt file surfacing as HTTP 500 with `INVALID_STORAGE_FILE` through the API, and two repository instances writing the same file.
- Files: `src/server/json-file-repository.ts`, `src/server/app.ts` (`handleError`)
- Risk: The durability and error-code contract is unverified; a regression can silently lose data.
- Priority: High

**Input limits and duplicates are not tested:**

- What's not tested: Long strings, `copies` upper bounds, duplicate ISBN or reader submissions, and non-JSON bodies on every route (only one `INVALID_JSON` path is covered in `tests/unit/api.test.ts`).
- Files: `src/server/app.ts`, `tests/unit/api.test.ts`
- Risk: Bugs listed under "Known Bugs" stay open without a failing test to drive the fix.
- Priority: Medium

**Hook bypass cases are not tested:**

- What's not tested: `cat ./.env`, `grep x .env`, `git add -f .env`, `git push origin HEAD:main` against the permission rules and hooks; the `reviewer` read of `.env` through a relative path.
- Files: `tests/unit/protect-files.test.ts`, `tests/unit/reviewer-readonly.test.ts`, `.claude/settings.json`
- Risk: The documented protection in `docs/about.md` is stronger than what is tested.
- Priority: High

**E2E isolation:**

- What's not tested: Clean-state runs. The e2e scenario relies on random titles because it writes to the developer's data file (see Tech Debt).
- Files: `tests/e2e/loans.spec.ts`, `playwright.config.ts`
- Risk: Flaky results if the data file grows or a previous run left one-copy books checked out.
- Priority: Low

---

_Concerns audit: 2026-10-22_
