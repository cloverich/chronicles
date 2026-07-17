# Lexical Editor Migration

> **Status: COMPLETE (July 2026).** Lexical is the sole editor; Plate and the
> Slate⇄MDAST transformer are fully removed (commits `11ae356`, `f24f477`,
> `3f53af7`). The remaining roadmap was cut, not built — see the Decisions
> section. This doc is retained as the historical record of the migration.
> Deferred follow-ons live in the web work: media handling →
> [chronicles-web-local.md](chronicles-web-local.md); minor editor polish → backlog.

**Goal (met):** Replace Slate/Plate with Lexical. Markdown-first, vitest-driven, incremental.

---

## Architecture

```
markdown ⇄ LexicalState ⇄ React
```

Lexical's native `@lexical/markdown` transformers handle import/export. Custom syntax (note links, media) uses custom nodes + transformers. No MDAST bridge — Lexical owns the roundtrip.

MDAST remains used elsewhere in the app (indexer, search) but the editor pipeline is purely Lexical.

---

## Decisions — Lexical is done, ship it (July 2026)

The author has dogfooded Lexical as the default editor for months. Verdict:
**Lexical is good enough to be the only editor.** The remaining roadmap is
cut, not completed:

- **Phase 6 (image gallery): CUT.** Not worth building. Consecutive images
  render fine as individual images; the lightbox/grid was a Plate-era nicety,
  not a requirement.
- **Phase 7 (video / image-upload changes): DEFERRED INDEFINITELY to the web
  version.** Media upload/handling changes ride on a new media pipeline (R2 or
  a local file server), not Electron's `chronicles://` handler. Do it once,
  there. See [chronicles-web-local.md](chronicles-web-local.md).
- **Phase 8 (polish): DEFERRED to backlog** (some items "maybe"), except the
  `Ctrl+E` macOS fix which is **done**.
- **Phase 9 (dogfood): satisfied** by months of real daily use.
- **Phase 10 (default swap): effectively done** — Lexical is already the
  default editor (`EditorMode.Editor` renders the Lexical `EditorLayout`). The
  only remaining work is **removing Plate entirely** (see below).

### Remaining work: remove Plate (in progress)

This is now the _only_ active work in this migration. "Remove Plate" is not a
simple delete — the Lexical editor and the markdown pipeline still reach into
`src/views/edit/editorv2/`. Removal is staged (see
[Plate Removal Plan](#plate-removal-plan) below). Once complete, this project
is closed.

---

## Current State (March 20, 2026)

**Done:**

- Markdown roundtrip contract (headings, lists, quotes, code blocks, inline formatting, links)
- Integration seam: Lexical mode selectable via debug dropdown, markdown in/out wired
- Formatting shortcuts: `Cmd+B` (bold), `Cmd+I` (italic), `Cmd+E` (inline code), `Cmd+Shift+S` (strikethrough), `Cmd+U` (underline)
- `MarkdownShortcutPlugin` typing triggers covered by vitests (`## `, `> `, `` ` ``, `- `, `1. `, fenced code)
- Code block syntax highlighting wiring via `@lexical/code` (`CodeHighlightNode` + `registerCodeHighlighting`)
- Note links: custom `ChroniclesNoteLinkNode`, markdown transformer, `@`-trigger dropdown, click navigation
- Regular links: floating toolbar (edit/unlink/open), paste-to-link conversion
- Images: custom `ChroniclesImageNode`, markdown roundtrip, drop/paste upload via `client.files.uploadImageBytes()`, max-size rendering constraints
- Expanded vitest coverage across roundtrip, render contracts, and editor interactions, including image workflows

**Superseded by the Decisions block above.** Phases 6–10 are cut, deferred, or
satisfied; the only open task is Plate removal.

## Plate Removal Plan

**Coupling map (verified July 2026).** The blast radius is the editor layer
only — the indexer / node-client / search do **not** touch Slate. Three layers:

1. **Plate editor proper** — `src/views/edit/editorv2/PlateContainer.tsx` and
   its Plate feature/plugin tree; the `EditorMode.Lexical` case in
   `index.tsx` that renders `<PlateContainer>` (note: the enum label is
   misleading — `EditorMode.Editor` is the real Lexical editor); the
   `platejs` / `@platejs/*` deps.
2. **Slate ⇄ MDAST transformer** — `src/markdown/remark-slate-transformer/`;
   the `stringToSlate` / `slateToString` / `slateToMdast` / `mdastToSlate`
   exports in `src/markdown/index.ts`; the Slate methods on
   `EditableDocument.ts` (`slateContent`, `getInitialSlateContent`,
   `setSlateContent`, `mdastDebug`, the `"slate-dom"` save path); the `slate*`
   deps; the `SlateDom` and `Mdast` debug `EditorMode`s.
3. **Shared code Lexical still needs — EXTRACT, don't delete.** Lexical
   (`EditorLayout`, `LexicalNoteLinkPlugin`, `lexicalMarkdown`,
   `LexicalLinkToolbarPlugin`), the read-only editor, and the markdown editor
   import from `editorv2`: `components/Toolbar`, `components/Tooltip`,
   `components/Button`, `features/toolbar/DebugDropdown`, and
   `features/note-linking/toMdast` (`parseNoteLink`). `src/markdown/index.ts`
   also imports `features/images/toMdast`. These must move to neutral homes
   before `editorv2/` can be deleted.

**Staged execution (multiple commits):**

- **Commit 1 — Extract shared code out of `editorv2`.** Move the shared UI
  primitives and pure markdown helpers (layer 3) to neutral locations (e.g.
  `src/views/edit/components/`, and a markdown-side home for `parseNoteLink` /
  image `toMdast`). Repoint Lexical, read-only, markdown editors, and the
  markdown pipeline. No behavior change; both editors still work. Lint + tests
  green.
- **Commit 2 — Delete the Plate editor.** Remove `PlateContainer` + the Plate
  feature tree, the `EditorMode.Lexical`→Plate case, collapse the `EditorMode`
  enum, drop `platejs`/`@platejs/*` from `package.json`. Verify **before**
  confirming that `EditableDocument`'s save path used by Lexical does not go
  through the Slate methods (Lexical deals in markdown strings).
- **Commit 3 — Delete the Slate transformer + `EditableDocument` Slate path.**
  Remove `remark-slate-transformer/`, the Slate exports from
  `src/markdown/index.ts` and their tests, the Slate methods on
  `EditableDocument`, the `SlateDom`/`Mdast` debug modes, and the `slate*`
  deps.

Each commit: `yarn lint` + `yarn test` green before the next.

---

## Phases

Each phase adds features AND vitests. No phase is complete without test coverage.

### Phase 3 — Feature Parity: Marks & Blocks

Port remaining text formatting and block types to reach parity with Plate.

| Feature           | Plate has                                            | Lexical has                                                      | Work needed                                                              |
| ----------------- | ---------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Bold              | `Cmd+B`                                              | `Cmd+B`                                                          | Done                                                                     |
| Italic            | `Cmd+I`                                              | `Cmd+I`                                                          | Done                                                                     |
| Strikethrough     | `~~text~~` autoformat                                | `Cmd+Shift+S` + markdown roundtrip                               | Verify `~~` typing trigger explicitly                                    |
| Underline         | `Cmd+U`                                              | `Cmd+U`                                                          | Done — note: underline has no markdown syntax, Cmd+U applies format only |
| Inline code       | `` `text` `` autoformat, `Cmd+E`                     | `Cmd+E` + backtick trigger                                       | Done                                                                     |
| Code blocks       | ` ``` ` autoformat, `Cmd+Alt+8`, syntax highlighting | Fenced trigger + syntax-highlighting wiring + language roundtrip | Done — `Cmd+Alt+8` toggle and language picker UI shipped                 |
| Task lists        | `[ ] ` autoformat (broken in Plate)                  | Checklist markdown roundtrip + checklist rendering               | Typing autoformat can remain deferred; Plate behavior was already broken |
| Headings typing   | `# `, `## `, `### `                                  | Via `MarkdownShortcutPlugin`                                     | Verified with explicit typing tests                                      |
| Blockquote typing | `> `                                                 | Via `MarkdownShortcutPlugin`                                     | Verified with explicit typing tests                                      |
| Lists typing      | `- `, `1. `                                          | Via `MarkdownShortcutPlugin`                                     | Verified with explicit typing tests                                      |

**Vitests:**

- Strikethrough: shortcut applies/removes, markdown roundtrip `~~text~~`
- Underline: shortcut applies/removes (no markdown representation — confirm underline text does not corrupt markdown on save)
- Inline code: `Cmd+E` shortcut applies/removes
- Code blocks: ` ``` ` typing creates code block, syntax highlighting renders classes, code block roundtrip preserves language tag
- Headings: typing `## ` at line start creates h2 (test the MarkdownShortcutPlugin trigger, not just roundtrip)
- Blockquote: typing `> ` at line start creates blockquote
- Lists: typing `- ` creates unordered list, `1. ` creates ordered list

**Exit criteria:** All Plate marks and block types either work in Lexical or are explicitly deferred with rationale.

**Observed constraints (March 20, 2026):**

- Double-enter list escape is implemented in Lexical mode.
- Tab/Shift+Tab list indent and outdent are implemented in Lexical mode.
- Code language can be changed from an in-editor picker UI.
- Code-block escape behaviors are implemented (`Cmd+Enter`, and Enter on empty trailing line).
- Any remaining keyboard UX deltas should be treated as polish follow-ups, not parity blockers.

---

### Phase 4 — Note Link Creation

Note link navigation and markdown IO already work. This phase completes the creation flow.

| Feature                               | Status                   |
| ------------------------------------- | ------------------------ |
| `@` trigger opens dropdown            | Done                     |
| Search results populate dropdown      | Done                     |
| Arrow keys + Enter to insert          | Done                     |
| Click on existing note link navigates | Done                     |
| Dropdown positioning                  | Verify — may need polish |
| Empty state / no results              | Done                     |
| Escape closes dropdown                | Done                     |

**Vitests:**

- `@` trigger shows dropdown, typing filters results
- Enter inserts note link node with correct URL format
- Escape closes dropdown without inserting
- Empty search shows appropriate state
- Inserted note link roundtrips correctly in markdown

**Exit criteria:** Note link creation UX matches Plate behavior. All interactions tested.

---

### Phase 5 — Images

Images are local-first: stored as attachments on disk. At render time, relative paths are translated to loadable URLs. Currently this uses `chronicles://` protocol (Electron) or will use `http://localhost:{port}/` (Electrobun — see `docs/plans/pending/electrobun-migration.md` "Local File Server Design"). The translation layer lives in `src/hooks/images.tsx` (`prefixUrl` / `unPrefixUrl`) and is transparent to the editor — Lexical image nodes just receive a src URL.

| Feature                  | Status                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| Image rendering          | Done — custom `ChroniclesImageNode` decorator renders `<img>` with attachment URLs                      |
| Drag-and-drop upload     | Done — `LexicalImageUploadPlugin` intercepts `DROP` and inserts uploaded image nodes                    |
| Paste upload             | Done — `LexicalImageUploadPlugin` intercepts `PASTE` image files and inserts uploaded image nodes       |
| Image markdown roundtrip | Done — custom markdown transformer roundtrips `![alt](url)`                                             |
| Max display size         | Done — image class constrains display (`max-height: 320px`, `max-width: 80%`) to match Plate-era sizing |

**Not porting (defer to later):**

- Image resize handles (Plate doesn't have them either — planned for bun-client era)
- Remote image blocking (keep, but implement when wiring up the full media pipeline)

**Vitests (implemented):**

- Image markdown roundtrip: `![alt](url)` imports and exports correctly
- `ChroniclesImageNode` renders `<img>` with correct src and alt
- Drag-and-drop: simulated drop event with `File` triggers upload and node insertion
- Paste: simulated paste event with image file data triggers upload and node insertion
- Multiple consecutive images render independently (no gallery yet)

**Exit criteria:** Completed (March 20, 2026). Single images display and can be added via drag-drop/paste. Markdown fidelity preserved.

---

### Phase 6 — Image Gallery

Plate groups consecutive images into a lightbox gallery automatically.

| Feature       | Work needed                                                 |
| ------------- | ----------------------------------------------------------- |
| Auto-grouping | Detect consecutive image nodes, wrap in gallery decorator   |
| Grid layout   | 2 images: 48% width each. 3+: 31% width, "+N more" overflow |
| Lightbox      | Click to open full-screen dialog, arrow key navigation      |

**Vitests:**

- 2+ consecutive images grouped into gallery node
- Gallery renders grid layout with correct image count
- Lightbox opens on click, navigates with arrow keys
- Single image does NOT become a gallery
- Adding/removing images updates gallery grouping

**Exit criteria:** Gallery behavior matches Plate. Lightbox works.

---

### Phase 7 — Video & File Embedding — DEFERRED to Chronicles Cloud

**Deferred (July 2026).** Video/file embedding is punted to the web version
rather than built against Electron's `chronicles://` protocol handler. Video
seeking was already broken under that handler (no HTTP Range support), and the
media pipeline is exactly what changes in the cloud design: attachments move to
R2, served over HTTP with native Range support, and `chronicles://` URLs are
rewritten to `/files/` routes. Building video against the soon-to-be-replaced
protocol handler is throwaway work.

Do it there, on the real media pipeline. See
[cloud-web.md](cloud-web.md) (assets / R2, Phase 2).

Original scope, for whoever picks it up later:

| Feature             | Work needed                                                          |
| ------------------- | -------------------------------------------------------------------- |
| Video rendering     | Custom `VideoNode`, renders `<video>` with native controls           |
| Video drag-and-drop | Extend media upload plugin for video MIME types                      |
| File links          | Drop non-image/video files → insert as link with "File: {name}" text |

---

### Phase 8 — Editor Polish & Keyboard Behavior — DEFERRED

**Mostly deferred (July 2026).** Per the "observed constraints" note in Phase 3,
most of this already works in Lexical mode (double-enter list escape, Tab/
Shift+Tab indent/outdent, `Cmd+Enter` block exit, code-block exit). Remaining
polish (trailing-block guarantee, etc.) is deferred — not a blocker for the
default swap. Revisit after Phase 10 if daily use surfaces friction.

**Exception — fixed (July 2026): `Ctrl+E` (end of line) on macOS.**
`LexicalFormattingShortcutsPlugin` treated Ctrl and Cmd as interchangeable
(`event.metaKey || event.ctrlKey`), so macOS Ctrl+E was hijacked as the
inline-code shortcut instead of moving the cursor to end of line. Ctrl+A
"worked" only because no handler matched `a`. Fixed by requiring the platform
modifier — Cmd on Apple, Ctrl elsewhere (`IS_APPLE` check) — so native
emacs-style Ctrl bindings pass through. macOS-only app today; the platform
check keeps a future web build correct on Windows/Linux.

Original scope, for the deferred remainder:

| Feature                  | Work needed                                                            |
| ------------------------ | ---------------------------------------------------------------------- |
| Exit break (`Cmd+Enter`) | Exit current block (code block, quote, list) to new paragraph          |
| Trailing block           | Ensure document always ends with an empty paragraph for easy appending |
| Indent/outdent           | Tab/Shift+Tab in lists                                                 |
| Code block exit          | Enter on empty line at end of code block exits to paragraph            |

---

### Phase 9 — Human Trial & Fixture Expansion

- Use debug toggle to edit real notes in Lexical mode across a variety of note types
- Catalog any rendering or editing regressions
- Add regression fixtures for failures discovered during trial
- Expand test fixtures with representative real-world notes (heavy linking, mixed media, long documents)

**Exit criteria:** Author can use Lexical for daily journaling without switching back to Plate.

---

### Phase 10 — Default Swap

1. Make Lexical the default editor mode
2. Move Plate to debug dropdown as "Plate (legacy)"
3. Run in this configuration for ≥1 week of daily use
4. Remove Plate entirely once confidence is established

**Exit criteria:** Plate code deleted. Lexical is the only editor.

---

## Idioms & Maintainability

Rules for the Lexical codebase as it grows:

1. **One plugin per file.** Each plugin is a React component using `useLexicalComposerContext`. Keep them focused — a plugin that does formatting shortcuts should not also handle link toolbar logic.

2. **Commands over DOM hacks.** Use Lexical's command system (`editor.dispatchCommand` / `editor.registerCommand`) for all editor mutations. Never reach into the DOM to modify editor content.

3. **Transformers are pure.** Markdown transformers (`TextMatchTransformer`, `ElementTransformer`) should be stateless functions. Side effects belong in plugins.

4. **Test the contract, not the internals.** Vitests should assert on markdown roundtrip output and rendered DOM, not on Lexical's internal node tree structure. This keeps tests stable across Lexical version upgrades.

5. **Theme classes, not inline styles.** All visual styling goes through the Lexical theme config object. Components should not apply ad-hoc styles.

6. **No Plate patterns.** Don't port Plate idioms (transform interception, path-based selection, plugin registries). Use Lexical's native patterns even when they feel different.

---

## TODO: highlight.js Code Theme Integration

The Lexical editor currently uses hardcoded Tailwind classes for syntax highlighting tokens (`codeHighlight` in the Lexical theme object). The app already has full hljs infrastructure in place:

- `src/themes/hljs.ts` — `loadHljsThemeCSS()`, `listHljsThemes()`, `resolveHljsDir()`
- `src/views/StyleWatcher.tsx` — `applyHljsTheme()` (currently commented out, was for Plate)
- Theme config schema supports `codeTheme` field; preferences store `codeThemeLight`/`codeThemeDark`
- Defaults: `github` (light), `github-dark` (dark)

**~256 themes available** from highlight.js (80 top-level + 176 base16 variants). These are CSS files ranging from ~1-5KB each. Need to evaluate bundle size impact: if total is reasonable (~500KB-1MB), we could bundle all themes and dynamically load the active one at runtime via `<style>` injection (the `applyHljsTheme` pattern already does this). Otherwise, ship a curated subset.

**Work needed:** Map Lexical's `CodeHighlightNode` token types to hljs CSS classes (or apply hljs CSS directly to the code block), re-enable `applyHljsTheme` for Lexical, and wire up a theme selector in preferences/settings.

---

## Risk Register

1. **Markdown drift:** Mitigated by roundtrip tests on every feature. Every phase requires vitest coverage before completion.
2. **MarkdownShortcutPlugin gaps:** Some typing triggers may not work as expected. Test each one explicitly rather than assuming the plugin handles everything.
3. **Media complexity:** Image gallery and video are the riskiest features. Gallery grouping logic will need careful design. Defer video upload if it blocks progress.
4. **Scope creep:** Hard phase gates. Don't start Phase N+1 until Phase N's tests pass and exit criteria are met.
