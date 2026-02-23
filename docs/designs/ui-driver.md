# UI Driver Design

## Goals

**Primary: LLM-assisted exploration.** LLMs working on this codebase need to observe running UI state — especially the editor — to reason correctly. Without this, even capable models consistently fail on Plate/SlateJS tasks because they cannot see what the editor actually contains or how it responds to input.

**Secondary: Regression specs.** A small smoke suite that proves core flows work. Useful as a binary search aid: if it passes, issues are in the details; if it fails, something fundamental broke. Not exhaustive — just reliable enough to be trusted.

Both goals share the same infrastructure.

---

## Tooling: Playwright for Electron

Playwright is the base layer. It has first-class Electron support:

- Launches and attaches to the app process
- `page.evaluate()` runs arbitrary JS in the renderer — equivalent to the DevTools console
- Accessibility tree snapshots are text-based and token-efficient
- Built-in wait/retry logic replaces ad-hoc `setTimeout` polling
- Standard, maintained, community-supported

This replaces the file-polling approach entirely.

**Screenshots** are available but used sparingly — as a corrective or pre-stop step when the LLM is disoriented or needs to verify unexpected state. Not the primary sensing mechanism.

---

## The Testing Surface

The app is conceptually simple. The surface is small and fully enumerable across four areas:

**Search / Document Index**
- Search input (tokens visible, editable)
- Search results list (selectable)
- Sidebar toggle
- Settings navigation

**Sidebar**
- Journal list (known journals, selectable)
- Tag list (selectable)
- Create journal
- Delete journal

**Settings Page**
- Settings fields (visible, updatable)

**Editor**
- Document title input
- Tags input
- Editor body (enter text, observe content)
- Toolbar and keyboard shortcuts (trigger state changes)
- Editor state dump (see below)

This is roughly 20–30 meaningful interactions. The selector config can cover all of them exhaustively.

---

## Selector Strategy

**Aria-first.** `aria-label`, `role`, `placeholder`, and similar attributes are preferred. This is also an accessibility improvement — the app benefits regardless of testing.

**`data-testid` as fallback.** For elements with no semantic identity, explicit test IDs are acceptable. Unglamorous but unambiguous.

**No runtime improvisation.** Selectors are authored once, reviewed, and treated as stable. The LLM may derive an initial selector config from the surface description above, but as a discrete step — a human reviews the output before it becomes the contract. Runtime selector inference (`"find something that looks like a title"`) is explicitly out of scope.

The selector config should be independently testable: given a known app state, assert that each surface element is found. If a selector breaks, the failure is isolated to the config — not buried in test logic.

---

## Editor State

The editor (Plate/SlateJS) is a special case. The accessibility tree shows text content but not structure — block types, nesting, selection, marks, plugin state. This is the primary reason LLMs struggle with editor tasks.

Solution: expose a preload API that serializes the Slate model:

```ts
window.chronicles.editor.getState() // returns serialized Slate value
```

Called from Playwright via `page.evaluate(() => window.chronicles.editor.getState())`. Returns structured JSON — block types, children, marks, selection — directly to the test or LLM context. No file I/O needed.

Wiring: the editor exposes a ref or publishes state to a module-level store; the preload reads from it. Standard React pattern, not a deep change.

---

## Layer Summary

```
[ Test / LLM ]          — describes intent or asks questions
      ↓
[ Playwright ]          — interacts with app; returns snapshots, eval results
      ↓
[ Selector config ]     — stable, reviewed map of surface elements
      ↓
[ App markup ]          — aria labels, roles, testids; preload editor.getState()
```

Failures have a clear home:

| Symptom | Likely layer |
|---|---|
| Element not found | Selector config or app markup |
| Wrong element found | Selector config |
| Test logic incorrect | Test / LLM layer |
| UI behavior broken | App code |

---

## What's Not Here

Specific implementation plans — what to build in what order — live in `docs/plans/`. This document captures the *why* and *how the layers relate*, not the build sequence.
