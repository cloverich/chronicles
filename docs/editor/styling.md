# Editor Styling

Styling is managed through Tailwind CSS v4 classes, applied to Lexical nodes via the `theme` object passed to `LexicalComposer`. See [docs/editor/lexical.md](lexical.md) for plugin/DOM constraints.

## Key Files

- **`src/views/edit/lexical/LexicalBasedEditor.tsx`**: Editor setup — the `theme` object in `initialConfig` maps each Lexical node type (`paragraph`, `heading.h1`/`h2`/`h3`, `quote`, `code`, `codeHighlight.*`, `list.*`, `link`, `text.*`) to Tailwind classes, which Lexical attaches to the corresponding DOM elements
- **`src/views/edit/lexical/ChroniclesImageNode.tsx`**: Custom node that renders its own DOM directly (not via the `theme` object) and sets classes imperatively
- **`src/views/edit/lexical/EditorLayout.tsx`**: Layout wrapper — flex column with `items-center` for centering
- **`src/index.css`**: CSS custom properties (widths, font families, font sizes) and `@utility` definitions
- **`src/views/StyleWatcher.tsx`**: Syncs user preference values to CSS custom properties at runtime
- **`src/views/preferences/index.tsx`**: Preferences UI — font family, font size, and max-width selectors
- **`src/electron/settings.ts`**: `IPreferences` shape and defaults for all style-related preferences
- **`src/hooks/stores/preferences.ts`**: MobX store; auto-saves preference changes with 1 s debounce

## CSS Custom Properties

All user-configurable style values are expressed as CSS custom properties defined in `src/index.css` (`:root`) and updated at runtime by `StyleWatcher`. Defaults below.

### Width

- `--max-w-prose` (`768px`): paragraphs, headings, blockquotes, lists
- `--max-w-code` (`var(--max-w-prose)`): code blocks (independently configurable)
- `--max-w-frontmatter` (`var(--max-w-prose)`): document title + front matter

### Font family

- `--font-body`, `--font-heading`, `--font-heading-2`, `--font-heading-3`, `--font-mono`
- `--font-system-body`, `--font-system-heading` — UI chrome (sidebar, preferences)

### Font size

- `--font-size-body` (`1rem`): paragraphs, list items (`theme.paragraph`, `theme.list.listitem`)
- `--font-size-heading` (`1.5rem`): H1 in editor content; H2/H3 scale via `calc()` in `theme.heading`
- `--font-size-title` (`1.5rem`): document title textarea in `FrontMatter`
- `--font-size-code` (`calc(--font-size-body * 0.875)`): code blocks and inline code

The first three font-size vars are user-editable in **Preferences → Font Sizes**.

## Width & Centering Model

Centering is achieved via `items-center` on the flex column wrapping the editor in `EditorLayout.tsx`. Each block-level theme class (`paragraph`, `heading.*`, `quote`, `list.ol`/`list.ul`, `code`) sets `w-full max-w-[var(--max-w-prose)]` (or `--max-w-code` for code). Breakout elements (images) omit `max-w` to fill the container.

## Tailwind v4 Pitfalls

**Never use `max-w-prose` as a class name.** Tailwind v4 has a built-in `max-w-prose` utility that outputs `max-width: 65ch`. Custom `@utility max-w-prose` definitions get silently overridden by the built-in (later in cascade wins). Use arbitrary value syntax instead:

```
WRONG:  max-w-prose                        → resolves to 65ch (Tailwind built-in wins)
RIGHT:  max-w-[var(--max-w-prose)]         → resolves to CSS variable value
RIGHT:  max-w-[var(--max-w-code)]          → resolves to CSS variable value
```

**Flex centering requires `w-full` on intermediate containers.** When a parent has `items-center`, child elements shrink to intrinsic width unless given `w-full`. Every intermediate `div` between the centering parent and the block elements needs `w-full`.

**`@utility` classes must be detectable by the scanner.** Tailwind only emits `@utility` CSS when it finds the class name in source files. Dense single-line strings (like hljs syntax highlighting classes) can cause scanner misses. Arbitrary value syntax `[var(--foo)]` is more reliable since it generates inline.

**Arbitrary variants (e.g. `[ul_&]:mb-0`) may not apply until a hard refresh or restart.** HMR does not always invalidate and rebuild the full Tailwind stylesheet when new utility classes appear for the first time in a session. If an arbitrary variant seems to have no effect, restart the dev server before debugging further.

**CSS variable changes from preferences may require a restart.** `StyleWatcher` injects CSS custom properties (e.g. `--max-w-prose`) at runtime from electron settings. When a preference value changes, the electron store updates on disk but the renderer process may not re-read it until restart. Even if the React state updates, the dev server's HMR may have cached the initial layout before the new variable value was applied. If a width or layout preference change doesn't seem to take effect, restart the app before debugging further.

## Styling Patterns

Most node styling is a plain Tailwind class string (or nested object of class strings) assigned to the matching key of the `theme` object in `LexicalBasedEditor.tsx`; Lexical applies the class to the DOM element it manages for that node — there is no per-element React component to style:

```tsx
theme: {
  quote:
    "max-w-[var(--max-w-prose)] w-full border-l-2 border-border pl-4 italic text-muted-foreground mb-8",
  heading: {
    h1: "max-w-[var(--max-w-prose)] w-full text-[length:var(--font-size-heading)] font-semibold font-heading mt-[1.6em] mb-[0.5em]",
    h2: "max-w-[var(--max-w-prose)] w-full text-[length:calc(var(--font-size-heading)*0.833)] font-semibold font-heading-2 mt-[1.4em] mb-[0.5em]",
  },
},
```

Custom nodes that render their own DOM (e.g. `ChroniclesImageNode`) set `className` imperatively in their `createDOM()`/update logic instead of going through the `theme` object.

## Adding/Modifying Styles

1. For built-in node types, edit the relevant key of the `theme` object in `src/views/edit/lexical/LexicalBasedEditor.tsx`
2. For custom nodes (`ChroniclesImageNode.tsx`, `ChroniclesNoteLinkNode.ts`), edit the class strings set directly in that node's DOM creation/update code
3. For width constraints, use `max-w-[var(--max-w-prose)]` or `max-w-[var(--max-w-code)]` — never bare `max-w-prose`
4. For new node types, add a `theme` key (or DOM styling in the node itself) and register the node per [markdown-pipeline.md](markdown-pipeline.md#extending)
