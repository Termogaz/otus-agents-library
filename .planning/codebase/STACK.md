---
last_mapped_commit: 523b7b810218d500abeddfe29445da600584b4bb
last_mapped_at: 2026-10-22
---
# Technology Stack

**Analysis Date:** 2026-10-22

## Languages

**Primary:**

- TypeScript 6.0.3 (strict, `noUncheckedIndexedAccess`) - all application code: `src/domain/`, `src/server/`, `src/client/`, `tests/`, `vite.config.ts`, `playwright.config.ts`, `eslint.config.js`, `.claude/hooks/*.ts`
- TSX - React components: `src/client/App.tsx`, `src/client/BooksSection.tsx`, `src/client/LoansSection.tsx`, `src/client/ReadersSection.tsx`, `src/client/main.tsx`

**Secondary:**

- JavaScript (ESM) - `eslint.config.js` only
- HTML - `index.html` (Vite entry, `lang="ru"`)
- JSON - data store `data/library.json` (gitignored; only `data/seed.json` is committed by policy, but it is not present in the repo now), `.mcp.json`, `.claude/settings.json`, `tsconfig.json`, `.prettierrc`

## Runtime

**Environment:**

- Node.js: `engines.node` is `>=22` in `package.json`; README says Node.js 22 or newer. Local runtime observed: v24.22.1 (nvm). GSD Core tooling requires Node >= 24 (see `AGENTS.md`).
- Module system: ESM (`"type": "module"` in `package.json`); `tsconfig.json` uses `"module": "ESNext"`, `"moduleResolution": "Bundler"`, `"noEmit": true`. Relative imports carry `.js` extensions (e.g. `./app.js`).
- Browser target for client: ES2022 libs with DOM (`tsconfig.json`), Chromium for e2e.

**Package Manager:**

- npm (version not pinned; no `packageManager` field, no `.nvmrc`, no `.node-version`)
- Lockfile: `package-lock.json` present, `lockfileVersion: 3`, 310 resolved entries, all from `https://registry.npmjs.org`
- Installation: `npm ci` (documented in `README.md`)

## Frameworks

**Core (runtime dependencies, `package.json` `dependencies`):**

- Express 5.3.0 - HTTP API in `src/server/app.ts` and entry `src/server/index.ts`; uses built-in `express.json()` body parser
- zod 4.6.7 - request validation at the server boundary (`src/server/app.ts`), storage file schema (`src/server/json-file-repository.ts`), and hook input parsing (`.claude/hooks/lib/hook-input.ts`)
- React 19.3.1 + react-dom 19.3.1 - client UI, entry `src/client/main.tsx` (uses `StrictMode`, `createRoot`)

**Testing:**

- Vitest 5.0.5 - unit and API tests; config in `vite.config.ts` (`test.include: ['tests/unit/**/*.test.ts']`)
- supertest 7.3.1 (with `@types/supertest` 7.2.1) - HTTP tests against `createApp` in `tests/unit/api.test.ts`, `tests/unit/health.test.ts`
- @playwright/test 1.64.1 - e2e in `tests/e2e/`; config `playwright.config.ts` (`testDir: tests/e2e`, chromium "Desktop Chrome", `webServer` runs `npm run dev`)

**Build/Dev:**

- Vite 8.3.4 - dev server on port 5173 (`strictPort`), proxies `/api` to `http://localhost:3000`; production build to `dist/client` (`npm run build`); config `vite.config.ts`
- @vitejs/plugin-react 6.1.2 - React Fast Refresh and JSX in Vite
- tsx 4.23.15 - runs the server in dev/start (`tsx watch src/server/index.ts`) and the Claude hooks (`.claude/settings.json`)
- concurrently 10.0.6 - runs API and UI together in `npm run dev`
- TypeScript 6.0.3 - type checking only (`npm run typecheck` = `tsc --noEmit`)
- ESLint 10.13.0 with `@eslint/js` 10.0.1 and typescript-eslint 8.71.2 (flat config `eslint.config.js`; `no-unused-vars` allows `_`-prefixed args)
- Prettier 3.9.10 - config `.prettierrc` (`singleQuote`, `trailingComma: all`, `printWidth: 100`); ignore list `.prettierignore`
- @types/node 26.6.5, @types/express 5.0.6, @types/react 19.3.0, @types/react-dom 19.3.0

**Agent tooling (not application runtime):**

- Claude Code: project settings `.claude/settings.json` (permissions, PreToolUse/PostToolUse hooks), subagent `.claude/agents/reviewer.md`, skills `.claude/skills/review-step/`, `.claude/skills/write-tests/`, rules `.claude/rules/domain.md`, `.claude/rules/e2e.md`
- Playwright MCP `@playwright/mcp@0.0.83` via `.mcp.json` (chromium, headless, npx; launched with proxy variables unset)
- GSD Core 1.18.0 (`@opengsd/gsd-core`) installed locally under `.claude/` (gitignored, excluded from lint); not part of the application

## Key Dependencies

**Critical (application):**

- `express` 5.3.0 - the whole HTTP layer; Express 5 async error propagation is relied on by `handleError` in `src/server/app.ts`
- `zod` 4.6.7 - input contracts (`bookInput`, `readerInput`, `loanInput`, `loanQuery`, `idParams` in `src/server/app.ts`) and file-format contract (`storeSchema` in `src/server/json-file-repository.ts`); uses `z.iso.datetime()`, `z.flattenError`, `z.prettifyError` (Zod 4 API)
- `react` / `react-dom` 19.3.1 - UI

**Critical (quality gates):**

- `typescript` 6.0.3 - `npm run typecheck`
- `vitest` 5.0.5 - `npm test`
- `@playwright/test` 1.64.1 - `npm run test:e2e`
- `eslint` 10.13.0 + `typescript-eslint` 8.71.2 - `npm run lint`
- `prettier` 3.9.10 - `npm run format:check`

**Infrastructure:**

- `vite` 8.3.4 - dev server, proxy, build
- `tsx` 4.23.15 - server runtime and hook runtime
- `concurrently` 10.0.6 - `npm run dev`
- `supertest` 7.3.1 - API tests

**Node built-ins used (no extra packages):**

- `node:crypto` (`randomUUID`) - id generation in `src/server/app.ts` and atomic temp file names in `src/server/json-file-repository.ts`
- `node:fs/promises` (`readFile`, `writeFile`, `rename`, `mkdir`) - JSON file storage
- `node:path`, `node:os`, `node:child_process` (`execFileSync` in `.claude/hooks/format-and-lint.ts`), `node:url`

**Dependency policy:** new npm dependencies require explicit approval (`AGENTS.md`); `ask` permission on `npm install` and `npm i` in `.claude/settings.json`; `package-lock.json` is deny-listed for edits.

## Scripts

From `package.json`:

- `npm run dev` - API (`tsx watch src/server/index.ts`) and UI (`vite`) together
- `npm run build` - `vite build` (client bundle to `dist/client`)
- `npm start` - `tsx src/server/index.ts` (API only, no static serving of the client)
- `npm test` / `npm run test:watch` - Vitest
- `npm run test:e2e` - Playwright
- `npm run lint`, `npm run format`, `npm run format:check`, `npm run typecheck`
- `npm run check` - typecheck + lint + format:check + test (the definition of "done" in `AGENTS.md`)

## Configuration

**Environment variables (read by the application):**

- `PORT` - API port, default `3000` (`src/server/index.ts`)
- `LIBRARY_DATA_FILE` - path to the JSON data file, default `data/library.json` (`src/server/index.ts`)
- `CLAUDE_PROJECT_DIR` - read by hooks to locate the project (`.claude/hooks/lib/hook-input.ts`); set by Claude Code, not by the app

No `.env` file is present in the repository root. `.env` and `.env.*` are gitignored (`.gitignore`) and denied for read and edit in `.claude/settings.json`. No `.env.example` is committed.

**Proxy environment:** npm and Playwright runs through a local HTTP proxy can fail with `ECONNRESET` or `webServer` timeouts; the documented workaround is `env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY ...` (`AGENTS.md`, `.mcp.json`).

**Build / tool configuration files:**

- `tsconfig.json` - strict TypeScript, `include`: `src`, `tests`, `*.ts`, `.claude/hooks`
- `vite.config.ts` - React plugin, dev server port 5173, `/api` proxy to `:3000`, build output `dist/client`, Vitest include pattern
- `playwright.config.ts` - e2e directory, reporters `list` and `html` (output `playwright-report/`), traces and screenshots on failure, `baseURL` `http://localhost:5173`
- `eslint.config.js` - flat config; ignores `dist/`, `coverage/`, `playwright-report/`, `test-results/`, GSD and hook-lib generated files
- `.prettierrc`, `.prettierignore` (ignores `dist/`, `coverage/`, `playwright-report/`, `test-results/`, `package-lock.json`)
- `.gitignore` - `node_modules/`, `dist/`, `*.tsbuildinfo`, test artifacts, `data/*.json` except `data/seed.json`, `data/*.tmp`, `.env*`, `.claude/settings.local.json`, GSD local files
- `index.html` - includes an empty `data:` favicon to avoid a 404 in the console

**Data storage:**

- Single JSON file `data/library.json` (current `data/` directory contains `library.json`). Format is versioned: `version: 1` (`STORAGE_VERSION` in `src/server/json-file-repository.ts`). Writes are atomic (temp file + `rename`).

## Platform Requirements

**Development:**

- Node.js >= 22 (local: 24.x), npm, Linux or WSL2. The project is kept on the WSL filesystem (`~/projects/library`), not `/mnt/c`, for speed (`AGENTS.md`).
- Chromium for Playwright: `npx playwright install chromium`; on WSL also `sudo npx playwright install-deps chromium`.

**Production:**

- No deployment target configured: no Dockerfile, no CI workflow (`.github/` absent), no hosting config (Vercel, Netlify, Fly, Render) tracked in git.
- `npm start` runs the API only; the client is built with `vite build` into `dist/client`, but the server does not serve it. Serving static assets in production is not implemented.
- Repository hosted on GitHub: `https://github.com/Termogaz/otus-agents-library` (public).

---

_Stack analysis: 2026-10-22_
