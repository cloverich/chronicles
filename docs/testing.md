# Testing

Two runners, one command. Nothing requires a display or a live Electron window.

```bash
yarn test          # both suites; what CI runs
yarn test:watch    # vitest in watch mode
yarn test:node     # node:test suites only
```

## Vitest (`src/**/*.vitest.{ts,tsx}`)

Renderer code: React views, hooks, stores driven through real providers, and the Lexical editor. Runs in jsdom with React Testing Library (`vitest.config.ts`, setup in `src/test/setup.ts`). Host services are injected per test: the in-memory NotesClient and the fakes in `src/test/fakes.ts`.

Conventions:

- Render the real component tree with real providers; mock at the service boundary (the contexts the composition root provides), not child components or stores.
- Assert on visible UI, not implementation details. No snapshot-heavy tests.
- Lexical behaviour is tested here in jsdom (`src/views/edit/lexical/*.vitest.tsx`); browser mode has not been needed.

## node:test (`src/**/*.test.ts`)

Backend and pure logic: `node-client` (Drizzle + better-sqlite3 against a temp DB), the markdown pipeline, search parser and stores, themes, fonts, frontmatter, utilities. Uses `chai` for assertions.

These run under Electron's own Node (`ELECTRON_RUN_AS_NODE=1 electron --import tsx --test …`) so `better-sqlite3` is loaded with the same ABI the app uses. See [development.md](development.md#native-modules-and-the-single-abi-test-setup) — do not add a rebuild step to the test scripts.

`src/bun-client/` has been removed; schema and migrations now live directly in `src/node-client/`.

## What is deliberately not here

**No Electron end-to-end suite.** Several attempts (Playwright, a file-polling UI driver, an in-process `electron-test` runner) were abandoned; the Electron test ecosystem has not been worth the cost. Whole-app verification is done by running the app (`HEADLESS=true yarn start`) and exercising key flows — increasingly by an LLM driving the app as a final QA step rather than by a checked-in harness. Historical context: [designs/ui-driver.md](designs/ui-driver.md), [plans/archived/playwright-e2e.md](plans/archived/playwright-e2e.md).

### Final QA pass (LLM-driven)

Run the packaged app on a scratch profile with `--remote-debugging-port=9333` (or the dev app with `CHRONICLES_DEBUG_PORT=9333`) and drive it with [`scripts/qa.mjs`](../scripts/qa.mjs). For every UI change:

- Exercise each state the change can be in, using its longest real strings (e.g. every disabled reason), not just the first that renders.
- Run `qa.mjs layout '<selectors for the changed UI>' --widths 480,800,1280` with the UI open (menus included: the container and its children). It catches clipped or scrolling boxes, overlaps, and buttons pushed out of view, which text reads (`innerText`) and a single screenshot miss.
- For actions that update the page, sample row positions and sizes while the action runs; nothing should move.
- Walk the cross-view round trip (change a setting elsewhere, come back) and seed awkward data (missing timestamps, a large journal).

## Gaps

- Coverage is thin on interaction flows (save, journal move, bulk actions); most renderer tests are render/shell checks.
- Tests write to a temp DB and do not load the Electron settings store; set `CHRONICLES_SETTINGS_DIR` to isolate settings when running the app from scripts.
