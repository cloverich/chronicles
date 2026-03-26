# Lexical Editor

Entry point: [src/views/edit/lexical/LexicalBasedEditor.tsx](../../src/views/edit/lexical/LexicalBasedEditor.tsx). Theme classes (fonts, widths, colors) are set in the `theme` object passed to `LexicalComposer`.

## Floating UI must portal to document.body

You **cannot** inject DOM into Lexical-managed elements — no `createPortal(jsx, codeElement)`, no `appendChild` into elements Lexical owns. It works in the browser but breaks Lexical's DOM reconciler in JSDOM tests (`selectionTarget.getBoundingClientRect is not a function`). Lexical walks children of its managed elements to map them back to its node tree; unexpected children cause selection failures.

Instead, portal to `document.body` with `position: fixed` and sync coordinates via `getBoundingClientRect` + scroll/resize listeners (use `requestAnimationFrame` to batch). Use a `z-index` below the titlebar (`z-10`) so the picker scrolls behind it.

Reference implementations:

- `LexicalCodeLanguagePlugin.tsx` — simplest example
- `LexicalLinkToolbarPlugin.tsx` — same pattern with edit/unlink UI
- `LexicalNoteLinkPlugin.tsx` — same pattern with keyboard navigation and async search
