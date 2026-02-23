# Testing Philosophy

## Core Principle

Test at the layer where the thing actually lives. Most of Chronicles is a standard React app that happens to run inside Electron. Electron is only load-bearing in the main process and preload — the renderer is plain React/TypeScript with a mockable client interface. Don't pay Electron-level overhead to test React-level concerns.

## Layers

### 1. Pure Logic — Vitest (Node)

Parsers, markdown pipeline, search query, date utilities, stores with no DOM dependency. Fast, no browser. This is what `node:test` currently covers, poorly.

### 2. React Components — Vitest (Browser Mode)

Components mounted with mock or fixture data. `window.chronicles` is an interface — mock it. This covers view logic, component behavior, and crucially the editor.

The editor (Plate/SlateJS) requires a **real browser**, not jsdom — `contenteditable` and Slate's selection APIs are unreliable in jsdom. Vitest's browser mode (`@vitest/browser`, backed by Playwright) runs tests in real Chromium without needing the full Electron app.

This layer covers the most ground for the least cost. Most LLM confusion about editor behavior can be resolved here: mount the editor with a fixture, fire a keystroke, assert on the Slate value. No Electron required.

### 3. Full App — Playwright for Electron

Smoke tests proving core flows work end-to-end. LLM-assisted exploration for understanding integrated behavior. Only for things that genuinely need the full running app.

See [docs/designs/ui-driver.md](ui-driver.md) for the detailed design of this layer.

## What We're Not Doing

**Storybook** — overlaps with Vitest browser mode for testing purposes. Not worth the overhead unless visual development workflow becomes a priority independently.

**Screenshot-driven LLM testing** — too expensive per step. Semantic snapshots + `page.evaluate()` for editor state is the approach. Details in the ui-driver design.

## Current State

The `node:test` + esbuild pipeline is being replaced with Vitest. Until then, component and browser-mode tests are blocked. See [docs/testing.md](../testing.md) for the current state of what exists.

## Workstreams

These can proceed independently:

1. **Vitest migration** — replace `node:test` + esbuild bundle pipeline; add browser mode for editor component tests
2. **Playwright E2E** — implement the ui-driver design: surface registry, selector config, smoke suite, LLM exploration support
