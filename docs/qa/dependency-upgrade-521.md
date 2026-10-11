# Dependency upgrade #521

Validated on 2026-10-11 after rebasing [PR #521](https://github.com/cloverich/chronicles/pull/521) onto current master (`a2ca051`).

## Changes

- Lexical 0.51.0, Electron 44.4.5, Tailwind/PostCSS 4.3.3 and the remaining dependency updates from the PR.
- Removed the active Prism highlighter and unused Lowlight/highlight.js dependency, syntax-theme loader, and packaged CSS. Code renders as plain monospace text.
- The code language control is a text field: arbitrary language names survive without a tokenizer's supported-language list. Fence metadata also survives language edits.
- Checklist shortcuts detect their trigger in a read-only state and perform the mutation in a separate writable update, resolving the text node by key.
- Custom node serialization remains handwritten; compact JSON export remains disabled.
- Composer migration is tracked separately in Engram: note `03h1514ddksxxb2l4ks9yydp7`, "Migrate the editor to LexicalExtensionComposer", with rationale, scope, and upstream links.

## Automated validation

- `yarn run electron-rebuild --force`: rebuilt better-sqlite3 for the new Electron ABI.
- `yarn lint:check`: formatting and TypeScript passed.
- `yarn test`: 119 renderer tests passed (one existing skip); 404 Electron-backed tests passed (one existing skip). This includes data migrations, derive/export/NotesClient vectors, and the separate MDAST pipeline.
- Editor coverage: 94 passing tests, including 11 new upgrade regressions in `src/views/edit/lexical/lexicalUpgrade.vitest.tsx`.

The new regressions cover arbitrary code languages, fence metadata, mixed nested lists, formatted link boundaries, custom-node JSON parsing, terminal images/tables through focus/autosave/reopen, whole-document delete/undo/redo, whole-document cut/paste, and image clipboard data containing both files and HTML.

## App startup and local install

- Ran the local-install skill's `install-build.sh`; production build and installation succeeded. Installed artifact: `packaged/114/Chronicles-darwin-arm64/Chronicles.app`, built at `07b0fd8`.
- Started the development app with `HEADLESS=true` against an isolated profile seeded at migration 0002. Main/preload bundles, type checking, renderer connection, and attachment migration completed without an application error.
- Started `/Applications/Chronicles.app/Contents/MacOS/Chronicles` with the same isolated profile. Main startup completed; the process stayed running. macOS emitted a sandbox-extension diagnostic for an Electron helper resource.
- Read back the scratch database: all eight migrations applied, both notes remained, the custom code language/metadata and code body were intact, the note link used stored form, and the note had a revision.
- Native visual/interaction QA was unavailable because the Mac was locked. Code colors, computed CSS, floating controls, and installed-app keyboard/navigation flows were not visually verified. Renderer tests cover these behaviors only where specified above.

The disposable profile and logs are under `/tmp/chronicles-pr521-smoke`, `/tmp/chronicles-pr521-dev.log`, and `/tmp/chronicles-pr521-installed.log` on the validation machine.

## Known normalization and limits

- Formatted links export as separate formatting markers around the surrounding text and link label; the formatting and text survive. The regression asserts the explicit normalized Markdown and a stable second roundtrip.
- The writable paragraph following a terminal image/table exports one trailing newline. Focusing alone does not invoke autosave; editing and reopening preserve the decorator source and attachment URL.
- Code fences nested inside quotes/lists are already unsupported by the rich-text Markdown importer. Compared against Lexical 0.48.0: quote fences are escaped as text, and indented list fences become top-level code blocks. This upgrade does not add support for them; use raw Markdown mode for those structures.
- Legacy code-theme preference/theme fields remain accepted but have no effect.
