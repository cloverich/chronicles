# Lexical Editor Migration

**Goal:** Replace Slate/Plate with Lexical. Markdown-first, vitest-driven, incremental.

---

## Architecture

```
markdown ⇄ LexicalState ⇄ React
```

Lexical's native `@lexical/markdown` transformers handle import/export. Custom syntax (note links, media) uses custom nodes + transformers. No MDAST bridge — Lexical owns the roundtrip.

MDAST remains used elsewhere in the app (indexer, search) but the editor pipeline is purely Lexical.

---

## Current State (March 18, 2026)

**Done:**

- Markdown roundtrip contract (headings, lists, quotes, code blocks, inline formatting, links)
- Integration seam: Lexical mode selectable via debug dropdown, markdown in/out wired
- Formatting shortcuts: `Cmd+B` (bold), `Cmd+I` (italic)
- `MarkdownShortcutPlugin` handles typing triggers (`# `, `> `, `**`, `` ` ``, `- `, `1. `)
- Note links: custom `ChroniclesNoteLinkNode`, markdown transformer, `@`-trigger dropdown, click navigation
- Regular links: floating toolbar (edit/unlink/open), paste-to-link conversion
- 42 vitest cases across roundtrip, render contracts, editor interactions

**Not done:** everything below.

---

## Phases

Each phase adds features AND vitests. No phase is complete without test coverage.

### Phase 3 — Feature Parity: Marks & Blocks

Port remaining text formatting and block types to reach parity with Plate.

| Feature | Plate has | Lexical has | Work needed |
|---------|-----------|-------------|-------------|
| Bold | `Cmd+B` | `Cmd+B` | Done |
| Italic | `Cmd+I` | `Cmd+I` | Done |
| Strikethrough | `~~text~~` autoformat | Theme class only | Add `Cmd+Shift+S` shortcut, verify `~~` trigger works |
| Underline | `Cmd+U` | No | Add shortcut — note: underline has no markdown syntax, Cmd+U applies format only |
| Inline code | `` `text` `` autoformat, `Cmd+E` | Autoformat only | Add `Cmd+E` shortcut |
| Code blocks | ` ``` ` autoformat, `Cmd+Alt+8`, syntax highlighting | Basic roundtrip only | Add syntax highlighting via `@lexical/code`, verify ` ``` ` trigger |
| Task lists | `[ ] ` autoformat (broken in Plate) | No | Add `ListItemNode` checkbox support or skip if Plate's was broken |
| Headings typing | `# `, `## `, `### ` | Via `MarkdownShortcutPlugin` | Verify works, add test |
| Blockquote typing | `> ` | Via `MarkdownShortcutPlugin` | Verify works, add test |
| Lists typing | `- `, `1. ` | Via `MarkdownShortcutPlugin` | Verify works, add test |

**Vitests:**

- Strikethrough: shortcut applies/removes, markdown roundtrip `~~text~~`
- Underline: shortcut applies/removes (no markdown representation — confirm underline text does not corrupt markdown on save)
- Inline code: `Cmd+E` shortcut applies/removes
- Code blocks: ` ``` ` typing creates code block, syntax highlighting renders classes, code block roundtrip preserves language tag
- Headings: typing `## ` at line start creates h2 (test the MarkdownShortcutPlugin trigger, not just roundtrip)
- Blockquote: typing `> ` at line start creates blockquote
- Lists: typing `- ` creates unordered list, `1. ` creates ordered list

**Exit criteria:** All Plate marks and block types either work in Lexical or are explicitly deferred with rationale.

---

### Phase 4 — Note Link Creation

Note link navigation and markdown IO already work. This phase completes the creation flow.

| Feature | Status |
|---------|--------|
| `@` trigger opens dropdown | Done |
| Search results populate dropdown | Done |
| Arrow keys + Enter to insert | Done |
| Click on existing note link navigates | Done |
| Dropdown positioning | Verify — may need polish |
| Empty state / no results | Verify — add test |
| Escape closes dropdown | Verify — add test |

**Vitests:**

- `@` trigger shows dropdown, typing filters results
- Enter inserts note link node with correct URL format
- Escape closes dropdown without inserting
- Empty search shows appropriate state
- Inserted note link roundtrips correctly in markdown

**Exit criteria:** Note link creation UX matches Plate behavior. All interactions tested.

---

### Phase 5 — Images

Images are local-first: stored as attachments, referenced via `chronicles://` URLs.

| Feature | Work needed |
|---------|-------------|
| Image rendering | Custom `ImageNode` (void/decorator), renders `<img>` with attachment URL resolution |
| Drag-and-drop upload | Plugin intercepts `DROP` events with image files, calls `client.files.uploadImageBytes()`, inserts node |
| Paste upload | Same plugin intercepts `PASTE` events with image data |
| Image markdown roundtrip | `![alt](url)` import/export via transformer |
| Max display size | CSS constraint (max-height 320px, max-width 80% — match Plate) |

**Not porting (defer to later):**

- Image resize handles (Plate doesn't have them either — planned for bun-client era)
- Remote image blocking (keep, but implement when wiring up the full media pipeline)

**Vitests:**

- Image markdown roundtrip: `![alt](../path.png)` imports and exports correctly
- ImageNode renders `<img>` with correct src and alt
- Drag-and-drop: simulated drop event with File triggers upload and node insertion
- Paste: simulated paste event with image data triggers upload and node insertion
- Multiple consecutive images render independently (no gallery yet)

**Exit criteria:** Single images display and can be added via drag-drop/paste. Markdown fidelity preserved.

---

### Phase 6 — Image Gallery

Plate groups consecutive images into a lightbox gallery automatically.

| Feature | Work needed |
|---------|-------------|
| Auto-grouping | Detect consecutive image nodes, wrap in gallery decorator |
| Grid layout | 2 images: 48% width each. 3+: 31% width, "+N more" overflow |
| Lightbox | Click to open full-screen dialog, arrow key navigation |

**Vitests:**

- 2+ consecutive images grouped into gallery node
- Gallery renders grid layout with correct image count
- Lightbox opens on click, navigates with arrow keys
- Single image does NOT become a gallery
- Adding/removing images updates gallery grouping

**Exit criteria:** Gallery behavior matches Plate. Lightbox works.

---

### Phase 7 — Video & File Embedding

| Feature | Work needed |
|---------|-------------|
| Video rendering | Custom `VideoNode`, renders `<video>` with native controls |
| Video drag-and-drop | Extend media upload plugin for video MIME types |
| File links | Drop non-image/video files → insert as link with "File: {name}" text |

**Defer:** Video is low-priority. Plate's video support was already broken. Implement basic rendering; skip upload if time-constrained.

**Vitests:**

- Video node renders `<video>` element with correct src
- Video markdown roundtrip (if video has markdown representation — may be HTML passthrough)
- File drop creates link node

**Exit criteria:** Videos render if present in existing notes. File drops produce links.

---

### Phase 8 — Editor Polish & Keyboard Behavior

| Feature | Work needed |
|---------|-------------|
| Exit break (`Cmd+Enter`) | Exit current block (code block, quote, list) to new paragraph |
| Trailing block | Ensure document always ends with an empty paragraph for easy appending |
| Indent/outdent | Tab/Shift+Tab in lists |
| Code block exit | Enter on empty line at end of code block exits to paragraph |

**Vitests:**

- `Cmd+Enter` inside blockquote creates new paragraph after it
- `Cmd+Enter` inside code block exits to paragraph
- Document always has trailing paragraph node
- Tab in list item indents, Shift+Tab outdents
- Enter on empty code block line exits code block

**Exit criteria:** Keyboard behavior feels natural for daily use.

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

## Risk Register

1. **Markdown drift:** Mitigated by roundtrip tests on every feature. Every phase requires vitest coverage before completion.
2. **MarkdownShortcutPlugin gaps:** Some typing triggers may not work as expected. Test each one explicitly rather than assuming the plugin handles everything.
3. **Media complexity:** Image gallery and video are the riskiest features. Gallery grouping logic will need careful design. Defer video upload if it blocks progress.
4. **Scope creep:** Hard phase gates. Don't start Phase N+1 until Phase N's tests pass and exit criteria are met.
