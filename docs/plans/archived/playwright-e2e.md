# Plan: Playwright E2E

Implements the approach described in [docs/designs/ui-driver.md](../designs/ui-driver.md).

## Prerequisites

- Playwright installed (`@playwright/test` + Electron support)
- App launchable with isolated test data (`CHRONICLES_USER_DATA` env var — already wired)
- At least one journal and document exist in the fixture state

---

## Step 1: Playwright Setup

- Install `@playwright/test`
- Add `playwright.config.ts` configured to launch Electron via `electron.launch()`
- Add `yarn test:e2e` script
- Verify the app opens and a basic `page.title()` or route check passes
- Add fixture setup: launch with `CHRONICLES_USER_DATA` pointing to a temp dir seeded with known journals/documents

---

## Step 2: Surface Audit & Markup

Walk the four surface areas and ensure each has a stable, unambiguous selector:

- **Search page** — search input, result items, sidebar toggle, settings link
- **Sidebar** — journal list items, tag list items, create/delete journal controls
- **Settings** — settings fields
- **Editor** — title input, tags input, editor body, toolbar buttons

For each element: prefer existing `aria-label`, `role`, or `placeholder`. Add `data-testid` where nothing reliable exists. Document the final selector map in `tests/e2e/surface.ts` (or similar) as named constants — not inline strings scattered across tests.

---

## Step 3: Surface Self-Test

Before writing scenario tests, write a single test that asserts the surface config itself:

- Launch app to a known state
- Assert every named surface element is found and visible
- This test is the canary — if it fails, the problem is in markup or selectors, not test logic

---

## Step 4: Editor State API

- Expose `window.chronicles.editor.getState()` via the preload
- Wire a module-level ref from the Plate editor to the preload surface
- Verify via `page.evaluate(() => window.chronicles.editor.getState())` returns a valid Slate value
- Document the shape of the returned value (block types, marks, selection)

---

## Step 5: Smoke Suite

Implement the regression suite. Covers one happy-path flow per major area:

1. **Search** — app loads, results are visible, typing in search filters results
2. **Navigation** — select a journal from sidebar, document list updates
3. **Create document** — create a new document, title is editable, document appears in list
4. **Edit document** — open a document, type in editor, verify editor state reflects input
5. **Settings** — open settings, a field is visible and editable

Each test should be deterministic, fast, and not dependent on prior test state.

---

## Step 6: LLM Skill

Write the ui-test skill that enables LLM agents to drive the app:

- Documents how to launch the app in test mode
- Documents the snapshot format (accessibility tree + editor state shape)
- Documents available commands: navigate, click, type, get editor state, screenshot
- Covers the four surface areas and what the LLM can observe in each
- Replaces the discarded file-polling skill entirely

---

## Out of Scope

- Visual regression (screenshots as assertions)
- Performance testing
- Multi-window or multi-instance scenarios
- Anything requiring the app to be built/packaged (tests run against dev build)
