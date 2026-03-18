# Lexical Evaluation for Chronicles: Replacing Slate/Plate Incrementally

**Analysis Date:** March 16, 2026  
**Goal:** Evaluate whether Lexical can replace the current Slate/Plate editor architecture with low migration risk, starting from Lexical's built-in markdown import/export rather than a custom bridge.

---

## Current Architecture (Baseline)

Chronicles' editor pipeline today is:

1. Parse markdown into MDAST (`micromark` + `remark`)
2. Convert MDAST to Slate nodes (`mdastToSlate`)
3. Render/edit in React via Plate plugins
4. Convert Slate nodes back to MDAST (`slateToMdast`)
5. Serialize to markdown for persistence

This gives us strong markdown fidelity, custom note-link/image behaviors, and predictable storage.

---

## Lexical vs Slate/Plate: Architectural Differences

### Data Model

- **Slate/Plate:** JSON tree is the primary source of truth and is directly manipulated by transforms.
- **Lexical:** Editor state is immutable snapshots over a node graph with command/update semantics and strict read/update phases.

**Impact:** Existing Slate transforms and normalizers do not carry over directly. We need adapter logic for command-driven updates.

### Plugin Surface

- **Plate:** Plugin registry with node definitions + editor method overrides.
- **Lexical:** Node classes + commands + React plugins (`OnChangePlugin`, `HistoryPlugin`, etc.).

**Impact:** Existing editor features map, but implementation style shifts from transform interception to command + node behavior.

### Markdown Strategy

- **Current:** markdown ↔ MDAST ↔ Slate, with explicit control in both directions.
- **Preferred Lexical spike path:** markdown transformers (`@lexical/markdown`) for import/export.

**Impact:** The shortest viable path is to let Lexical own markdown import/export first and only add custom transformers/nodes when Chronicles syntax demands it. The main architectural question is not "can Lexical parse markdown?" but "can we override it cleanly enough when we hit Chronicles-specific syntax?"

### Normalization & Invariants

- **Current:** Custom Plate normalization plugins enforce image/code/link invariants.
- **Lexical:** Invariants usually enforced via node transforms + command handlers.

**Impact:** We should expect to rewrite normalizers as Lexical transforms.

---

## Fit with Chronicles' Existing Pipeline

## Preferred Spike Architecture

`markdown ⇄ LexicalState ⇄ React`

MDAST remains important elsewhere in the app, but the spike should not start by rebuilding the current `markdown ⇄ MDAST ⇄ Slate` stack inside Lexical. The point of the spike is to learn how far Lexical's native markdown handling carries us before Chronicles-specific syntax forces customization.

**Why this is the right first cut**

- It minimizes new bridge code.
- It tests Lexical the way we would actually want to adopt it.
- It gives us a fast answer on whether custom syntax override points are strong enough.
- It keeps success/failure visible through markdown roundtrip tests instead of hand-wavy UI impressions.

## Fallback Architecture If Lexical Chokes

`markdown ⇄ MDAST ⇄ (adapter) ⇄ LexicalState ⇄ React`

This remains the fallback if native markdown support proves too rigid for Chronicles semantics. We should only pay this cost if note links or later media work show that the native path is not viable.

**Recommendation:** Start with Lexical-native markdown handling and treat note links as the first serious override test. If we cannot make note links behave correctly, that is a strong signal that deeper Chronicles features will also be painful.

---

## Minimal Replacement Editor (Spike)

A new minimal replacement seam exists in `src/views/edit/lexical/`:

- `minimalReplacementEditor.tsx`
  - markdown-in/markdown-out editing contract for drop-in experimentation
- `editorArchitecture.ts`
  - adapter interface + capability matrix for Slate/Plate vs Lexical
- `lexicalSpike.vitest.tsx`
  - verifies the capability deltas and editor contract behavior

This spike intentionally excludes frontmatter UI, note-link autocomplete, image galleries, upload handling, and slash/toolbar ergonomics.

The immediate next step is to replace the textarea-style seam with a real Lexical-backed editor while preserving the same `markdown in / markdown out` contract.

---

## Gap Analysis vs Current Editor

### Must-have functional gaps

1. **Custom note links (`[[wikilink]]` semantics + dropdown mention behavior)**
2. **Image/video pipeline and gallery grouping**
3. **Frontmatter-aware editing workflow**
4. **Markdown parity for custom OFM/tag/wiki syntax**
5. **Keyboard behaviors currently enforced by custom Plate plugins**

### Why note links are the proving ground

Note links are the first feature that meaningfully exercises all the hard parts at once:

- custom markdown syntax
- custom node modeling
- custom import/export behavior
- custom inline editing interactions
- app-specific suggestion UI

If Lexical cannot support note links cleanly, we should assume image/video, embeds, and other richer overrides will also be difficult. If note links do work, confidence rises materially.

### UX/operational gaps

1. Existing toolbar + floating link controls
2. Read-only renderer parity
3. Selection and composition edge cases (IME, mobile/webview)
4. Performance baselines on large notes

---

## Incremental Proof Plan (with Vitest)

### Current Status Snapshot (March 18, 2026)

**Implemented**

- Phase 0 baseline markdown contract is running with deterministic roundtrip and render-contract coverage (headings, lists, quotes, links, inline formatting, fixtures).
- Phase 1 integration seam is active: Lexical mode can be selected in the existing editor workflow and markdown in/out is wired.
- Formatting shortcuts are implemented and tested (`Cmd+B`, `Cmd+I`) with selection-boundary assertions.

**In Progress**

- Note links: markdown IO, note-link insertion flow, and click navigation are implemented; parity polish is still ongoing.
- Regular links: toolbar open/edit/unlink/open flows are implemented; active polish is focused on close behavior, placement, and visual consistency.
- Code blocks: basic markdown/code-block roundtrip is present; richer behavior parity remains in progress.

**Remaining**

- Media port (images, galleries, video).
- Deeper human trial pass over real notes after note-link/link polish stabilizes.
- Default switch and Plate removal gates.

### Phase 0 — Core Markdown Contract

- Build a real Lexical-backed spike using `@lexical/markdown`.
- Add Vitest coverage for headings, lists, quotes, code blocks, inline formatting, and normal links.
- Compare Lexical roundtrips against representative markdown fixtures from the existing pipeline.

**Exit criteria:** deterministic roundtrip for baseline markdown that appears in ordinary notes.

### Phase 1 — Editor Surface in the Existing Debug Workflow

- Add Lexical as a third editor mode alongside the current Plate editor and raw markdown mode.
- Reuse the top-right editor switch in the existing edit UI rather than creating a separate route or feature flag.
- Keep the integration seam simple: load note markdown in, emit markdown out.

**Exit criteria:** a note can be opened in Lexical mode, edited, and saved without crashes or obvious markdown corruption.

### Phase 2 — Note Link Viability Test

- Implement note-link support using Lexical nodes plus markdown transformer customization.
- Port only enough note-link UI to prove real editing behavior, including insertion/editing and the existing note-picker interaction shape where needed.
- Add Vitest coverage for note-link markdown IO, command behavior, and representative edge cases.

**Exit criteria:** `[[wikilink]]` notes roundtrip correctly and are editable in a way that feels viable for daily use.

### Phase 3 — Human Trial on Real Notes

- Use the debug toggle to open real markdown notes in Lexical mode.
- Focus on notes with mostly text and links; missing media support is acceptable at this stage.
- Validate that ordinary notes mostly render and edit correctly, even before image/video work exists.

**Exit criteria:** the editor is usable enough on real notes to justify deeper investment.

### Phase 4 — Fixture and Validation Pass

- Revisit test fixtures after the editor is actually usable.
- Make it easy to load, diff, and validate representative real-world notes.
- Expand fixtures around the failure cases discovered in Phases 1-3.

**Exit criteria:** fixture coverage reflects actual Chronicles note content rather than an abstract markdown subset.

### Phase 5 — Media Port

- Implement image behavior, then video behavior.
- Use this phase to test whether Lexical handles the richer embedded/media cases better than current Plate behavior.
- Accept that Plate's current video implementation is already broken; parity is not a sufficient bar here.

**Exit criteria:** image/video support is good enough that Lexical can replace Plate for the author's real workflow.

### Phase 6 — Default, Then Permanent Swap

- Make Lexical the default editor once it survives real usage.
- Continue using it in anger rather than carrying a long-lived feature flag.
- Remove Plate after confidence is established.

**Exit criteria:** Lexical is the normal editor and Plate is no longer needed.

---

## Testing Plan (Vitest-first)

1. **Unit tests** (fast): markdown import/export contract using Lexical's transformers.
2. **Component tests** (jsdom): editor renders initial markdown and emits markdown updates.
3. **Fixture parity tests**: compare Lexical roundtrip to representative existing notes and current markdown fixtures.
4. **Human validation**: use the existing debug editor switch to open real notes once note links are working.

The aim is to make migration confidence come from deterministic markdown outputs first, then targeted human testing once the editor becomes useful.

---

## Risk Register

1. **Markdown drift risk:** mitigated by roundtrip tests against real fixtures before and after each feature port.
2. **Override-point risk in Lexical markdown:** mitigated by testing note links early instead of discovering the problem late.
3. **Editor behavior regressions:** mitigated by command-level tests for critical shortcuts and focused human testing on real notes.
4. **Scope creep:** mitigated by explicit phase gates and a hard "note links first, media second" sequence.

---

## Recommendation

Proceed with the Lexical spike as a markdown-first experimental editor track. Let Lexical's native markdown handling do as much as it can, prove note links next, then human-test real notes through the existing debug toggle before investing in media. If note links fail, stop and reassess rather than building a larger migration on a weak foundation.
