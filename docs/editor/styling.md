# Editor Styling

Styling is managed through Tailwind CSS v4 classes on Plate.js element components.

## Key Files

- **`src/views/edit/editorv2/PlateContainer.tsx`**: Editor setup — maps Plate element types to React components via `usePlateEditor({ plugins, components })`
- **`src/views/edit/editorv2/EditorLayout.tsx`**: Layout wrapper — flex column with `items-center` for centering
- **`src/views/edit/editorv2/features/`**: Element components, each responsible for its own Tailwind styling
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

- `--font-size-body` (`1rem`): paragraphs (`ParagraphElement`)
- `--font-size-heading` (`1.5rem`): H1 in editor content; H2/H3 scale via `calc()` in `HeadingElement`
- `--font-size-title` (`1.5rem`): document title textarea in `FrontMatter`

All three font-size vars are user-editable in **Preferences → Font Sizes**.

## Width & Centering Model

Centering is achieved via `items-center` on the `PlateContent` flex column. Each block element sets `w-full max-w-[var(--max-w-prose)]` (or `--max-w-code` for code). Breakout elements (images, galleries) omit `max-w` to fill the container.

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

Element components wrap `PlateElement` with Tailwind classes:

```tsx
// Simple element
export const BlockquoteElement = (props: PlateElementProps) => (
  <PlateElement
    as="blockquote"
    className="text-muted-foreground my-6 w-full max-w-[var(--max-w-prose)] border-l-4 pl-6 italic"
    {...props}
  />
);

// Variant-based element using cva; font-size from CSS var via inline style
const headingVariants = cva("relative mb-1 max-w-[var(--max-w-prose)] w-full", {
  variants: {
    variant: {
      h1: "mb-[0.5em] mt-[1.6em] font-heading font-medium",
      h2: "mb-[0.5em] mt-[1.4em] font-heading-2 font-medium",
    },
  },
});
// style={{ fontSize: headingFontSizes[variant] }} — applied inline, not via Tailwind
```

Libraries used: `class-variance-authority` (cva) for variants, `cn` from `src/lib/utils` for class merging.

## Adding/Modifying Styles

1. Locate the element component in `src/views/edit/editorv2/features/`
2. Modify Tailwind classes in that file
3. For width constraints, use `max-w-[var(--max-w-prose)]` or `max-w-[var(--max-w-code)]` — never bare `max-w-prose`
4. For new elements, create a component and register it in `PlateContainer.tsx`
