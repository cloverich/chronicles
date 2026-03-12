# Testing Philosophy

## Core Principle

Test at the layer where the thing actually lives. Most of Chronicles is a standard React app that happens to run inside Electron. Electron is only load-bearing in the main process and preload — the renderer is plain React/TypeScript with a mockable client interface. Don't pay Electron-level overhead to test React-level concerns.

When testing renderer code, prefer rendering the real component tree with real context providers. Mock at the client or request boundary first, not at arbitrary child-component boundaries. Avoid mocking React components, hooks, or stores when a fake client, fake preload response, or provider fixture can drive the same behavior more honestly.

## Layers

### 1. Pure Logic — Vitest (Node)

Parsers, markdown pipeline, search query, date utilities, stores with no DOM dependency. Fast, no browser. This is what the current `node:test` suite covers today, and what should move to Vitest first.

### 2. React Components — Vitest (Browser Mode)

Components mounted with fixture data and real providers. `window.chronicles` is an interface — mock it at that boundary when needed. This covers view logic, component behavior, and crucially the editor.

The editor (Plate/SlateJS) requires a **real browser**, not jsdom — `contenteditable` and Slate's selection APIs are unreliable in jsdom. Vitest's browser mode (`@vitest/browser`, backed by Playwright) runs tests in real Chromium without needing the full Electron app.

This layer covers the most ground for the least cost. Most LLM confusion about editor behavior can be resolved here: mount the editor with a fixture, fire a keystroke, assert on the Slate value. No Electron required.

### 3. Full App — Playwright for Electron

Smoke tests proving core flows work end-to-end. LLM-assisted exploration for understanding integrated behavior. Only for things that genuinely need the full running app.

See [docs/designs/ui-driver.md](ui-driver.md) for the detailed design of this layer.

## What We're Not Doing

**Storybook** — overlaps with Vitest browser mode for testing purposes. Not worth the overhead unless visual development workflow becomes a priority independently.

**Screenshot-driven LLM testing** — too expensive per step. Semantic snapshots + `page.evaluate()` for editor state is the approach. Details in the ui-driver design.

**Deep tree mocking as the default testing style** — low-value tests that mock away layout, stores, and child components usually stop testing the real UI. If a test needs several component mocks to become manageable, the preferred move is to raise the seam to providers and fake the client/preload boundary instead.

## Current State

The renderer migration to Vite is complete. The remaining testing migration is replacing the current `node:test` + esbuild pipeline with Vitest, then adding browser-mode coverage for editor and component behavior. See [docs/testing.md](../testing.md) for the current state of what exists.

## Workstreams

These can proceed independently:

1. **Vitest migration** — replace `node:test` + esbuild bundle pipeline; add browser mode for editor component tests
2. **Playwright E2E** — implement the ui-driver design: surface registry, selector config, smoke suite, LLM exploration support
