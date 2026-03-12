# Vitest Renderer Plan

## Goal

Introduce Vitest for renderer-facing tests first, without forcing a full migration of the existing `node:test` and Electron-runner suites in the same pass.

This is a renderer-testing migration, not a blanket test migration.

## Scope

Vitest should own tests for the React application surfaces that now run behind Vite:

- `documents` — main search page
- `documents/edit` — editor surface and its immediate shell
- `preferences` — settings modal/pane

Initial focus is deliberately shallow:

- render smoke tests for the main surfaces
- simple interaction tests for isolated UI components
- route and shell wiring where cheap to test

Initial non-goals:

- migrating every current `*.test.ts`
- migrating editor browser-mode tests immediately
- replacing Playwright/E2E planning
- preserving the Electron-runner path as a first-class long-term strategy

## Testing Split

### Vitest now

Use Vitest for renderer code that benefits from Vite transforms and DOM rendering:

- React components
- route shells
- renderer-only hooks
- view-level stores and components driven through real providers with fake client/context data
- editor-adjacent UI that can run in jsdom

### Legacy Node tests stay for now

Keep the current `node:test` path available for code that is still easiest to run outside Vitest:

- markdown pipeline tests
- schema tests
- low-level utility tests
- pure parser/store tests that already work and are not urgent to migrate

These should move only when there is a clear reason, not as churn.

### Legacy Electron tests

The old `test:electron` flow should stop being the default direction for frontend testing.

Near-term posture:

- keep it runnable only as a legacy escape hatch if needed
- do not add new renderer coverage there
- prefer Vitest plus mocks for renderer behavior
- replace it later with either Vitest browser mode or Playwright/Electron where the full shell is actually required

## Surface Breakdown

### Main surfaces

1. `documents`
   - search layout renders
   - empty/loading/error states render
   - result list renders
   - sidebar/header shell renders
2. `documents/edit`
   - loading shell renders
   - error shell renders
   - top-level editor route chooses the expected mode container
   - front matter/header controls render
3. `preferences`
   - modal renders when open
   - main settings sections render
   - theme/font lists render with mocked preload APIs

### Sub-surfaces worth targeting early

- `DocumentItem`
- search input/layout shell
- editor loading state
- front matter sections
- editor toolbar/titlebar controls

## Implementation Order

### Phase 1: Establish Vitest

- add Vitest and renderer test deps
- add a `vitest.config.ts`
- add jsdom test setup
- split scripts so Vitest and legacy Node tests can coexist

### Phase 2: Add cheap renderer smoke tests

- `documents` render smoke tests
- `preferences` render smoke tests
- editor loading/error shell tests
- one route-level container smoke test if setup remains cheap

### Phase 3: Build confidence in sub-surfaces

- isolated tests for document list items, headers, and front matter controls
- light interactions via Testing Library

### Phase 4: Browser-mode editor tests

After the jsdom-based renderer smoke layer is stable:

- add Vitest browser mode
- cover Slate/Plate behaviors that require a real browser

## Best Practices For This Migration

- test from the surface boundary inward, not from implementation details outward
- prefer user-visible assertions over store internals when rendering UI
- render real component trees and real context providers whenever practical
- mock preload/client boundaries first
- avoid mocking child components, hooks, or stores unless the alternative is genuinely impractical
- keep first tests narrow and deterministic
- do not try to solve E2E coverage inside Vitest
- avoid snapshot-heavy tests; prefer explicit assertions on labels, controls, and states

## Expected Script Shape

Target end state for this phase:

- `yarn test` runs Vitest renderer tests
- `yarn test:node` runs the legacy `node:test` suite
- `yarn test:electron` is either removed, renamed as legacy, or left clearly outside the default workflow

## First Slice To Implement

1. Vitest config and setup
2. renderer smoke tests for:
   - documents surface
   - preferences surface
   - editor loading/error shell
3. script split so old tests remain runnable without blocking the new path
