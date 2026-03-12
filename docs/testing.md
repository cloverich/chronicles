# Testing

## Current State

Testing in Chronicles is minimal and partially broken. This document describes what exists, what doesn't work, and where things are headed.

---

## Renderer Tests (`yarn test`)

```bash
yarn test   # runs Vitest against renderer-focused *.vitest.ts / *.vitest.tsx files
```

Vitest now owns renderer-facing smoke tests and component-level tests that benefit from Vite transforms and a DOM environment.

Current coverage is intentionally shallow and focused on the main UI surfaces:

- `src/views/documents/index.vitest.tsx` — documents surface smoke states
- `src/views/edit/loading.vitest.tsx` — editor loading/error shell
- `src/views/preferences/index.vitest.tsx` — preferences modal surface

This is the new default direction for frontend testing.

### Renderer test preference

- Prefer rendering the real component tree with real providers.
- Mock at the client/request boundary first: `ClientContext`, preload APIs, or equivalent service interfaces.
- Avoid mocking child components, hooks, or stores unless there is a clear cost or isolation reason.
- Prefer visible UI assertions over implementation-detail assertions.

---

## Legacy Node Tests (`yarn test:node`)

```bash
yarn test:node   # bundles *.test.ts with esbuild, runs with node --test
```

These tests still use `node:test` (Node's built-in runner) with `chai` for assertions. The pipeline:

1. `scripts/test.mjs` — esbuild bundles all `*.test.ts` → `*.test.bundle.mjs`
2. `node --test 'src/**/*.test.bundle.mjs'` runs the bundles

**What actually has tests:**

- `src/markdown/index.test.ts` — markdown ↔ Slate roundtrip; the most substantive suite
- `src/preload/client/importer/frontmatter.test.ts` — frontmatter parsing
- `src/preload/client/util.test.ts` — utility functions
- `src/views/documents/search/SearchParser.test.ts` — search query parsing
- `src/views/documents/search/groupDocumentsByDate.test.ts` — date grouping
- `src/views/documents/SearchStore.test.ts` — search store
- `src/components/tag-input/TagStore.test.ts` — tag store

**What is stubbed:**

- `src/views/edit/index.test.ts` — test names only, no implementations

**Historical note:** The test runner was at some point migrated from mocha toward `node:test`. The migration is nominally complete but coverage is thin and several suites were never filled in.

---

## Legacy Electron Tests (`yarn test:electron`)

A separate runner exists for tests that require the Electron process (i.e., anything that imports from `electron` directly). These can't run under plain Node because `electron` is not available there.

```bash
yarn pretest:electron   # bundles *.electron-test.ts
yarn test:electron      # runs bundles inside an Electron process via electron-test-runner.mjs
```

Currently there are no meaningful electron tests in the repo. Do not add new renderer coverage here; prefer Vitest unless the full Electron shell is genuinely required.

---

## What's Missing

**Component / integration tests.** Vitest and React Testing Library now exist for renderer smoke tests, but coverage is still thin. The next step is to expand from shell-level render checks into isolated components and view logic, then add browser-mode coverage where jsdom stops being credible.

**E2E / UI tests.** No end-to-end test suite. There was an intern attempt at a file-polling UI driver (now discarded). A proper approach is under design — see [docs/designs/ui-driver.md](designs/ui-driver.md). Playwright-based E2E is still planned after the Vitest migration, so the renderer test stack is established first.

---

## Where Things Are Going

See [docs/designs/ui-driver.md](designs/ui-driver.md) for the design of the planned E2E and LLM-assisted testing approach, which covers:

- Playwright for Electron as the base layer
- A defined, stable testing surface across the four main UI areas
- Editor state introspection via a preload API
- A smoke suite for regression coverage
- LLM-assisted exploration as the primary goal
