# Theming

Chronicles uses a token-based theming system. Color palettes are defined as JSON files and applied at runtime via CSS custom properties. Themes can target light mode, dark mode, or both.

## How it works (code)

1. **Theme files** are JSON objects conforming to the `ThemeConfig` schema (`src/themes/schema.ts`).

2. **StyleWatcher** (`src/views/StyleWatcher.tsx`) runs a MobX reaction that watches `darkMode`, `themeLightName`, and `themeDarkName` preferences.

3. **Tailwind classes** like `bg-background`, `text-foreground`, `border-border` resolve to these custom properties via the `@theme` block in `src/index.css`. Components never reference raw color values — they use semantic token names.

4. **Built-in themes** (System Light, System Dark) are defined in `src/themes/builtins.ts` as TypeScript objects. They serve as the fallback if a user theme is missing or invalid.

5. **User themes** live in `<settingsDir>/themes/`. On startup the directory is created if absent. Themes are loaded, validated, and listed alongside builtins in the preferences UI.

## Key source files

| File                         | Purpose                                                             |
| ---------------------------- | ------------------------------------------------------------------- |
| `src/themes/schema.ts`       | `ThemeConfig` interface, token lists, `validate()` function         |
| `src/themes/builtins.ts`     | System Light and System Dark theme definitions                      |
| `src/themes/loader.ts`       | `listAvailableThemes()`, `loadThemeByName()`, `deleteThemeByName()` |
| `src/themes/importer.ts`     | `importThemeFile()` — validate + copy to themes dir                 |
| `src/views/StyleWatcher.tsx` | Runtime (mobx) application of theme colors as CSS custom properties |
| `src/index.css`              | `@theme` block mapping CSS variables to Tailwind utilities          |

## Token architecture

Tokens are split into two tiers:

- **Required** — every theme must provide these. They cover the core surfaces, text, accents, and interactive states.
- **Derivable** — optional. If omitted, the runtime falls back to a documented default (e.g. `card` defaults to `background`).

The canonical token list, derivation rules, and CSS property mappings live in `src/themes/schema.ts` (`REQUIRED_TOKENS`, `DERIVABLE_TOKENS`, `CSS_NAME`).

### Semantic pairing convention

Tokens follow a `surface` / `surfaceForeground` pairing convention. When a component sits on a surface, it uses the matching foreground token for text and icons:

| Surface                       | Background token | Foreground token        |
| ----------------------------- | ---------------- | ----------------------- |
| Page                          | `background`     | `foreground`            |
| Secondary (sidebar, titlebar) | `secondary`      | `secondaryForeground`   |
| Accent (hover highlights)     | `accent`         | `accentForeground`      |
| Card                          | `card`           | `cardForeground`        |
| Popover                       | `popover`        | `popoverForeground`     |
| Destructive                   | `destructive`    | `destructiveForeground` |

Mismatching these (e.g. using `accentForeground` on a `secondary` surface) causes contrast failures with custom themes. If adding UI, match the foreground token to whatever surface the element sits on.

## Creating a theme (user)

1. Start from a built-in theme as a template. The System Dark theme in `src/themes/builtins.ts` shows every token with its CSS mapping.

2. Create a `.theme.json` file:

```json
{
  "name": "My Theme",
  "version": "1.0.0",
  "mode": "dark",
  "colors": {
    "background": "#1a1a2e",
    "foreground": "#e0e0e0",
    ...
  }
}
```

3. **Color formats:** hex (`#1a1a2e`), HSL function (`hsl(222, 47%, 11%)`), or bare HSL triple (`222 47% 11%`).

4. **Validate** by importing through Settings > Appearance > Import Theme. Validation errors are shown in a toast with specific token-level messages. Alternatively, read `src/themes/schema.ts` for the `validate()` function signature — it returns all errors at once so you can fix them in one pass.

5. **Install** via the Import Theme button, or copy the file directly into `<settingsDir>/themes/`.

6. **Select** from the Light Theme or Dark Theme dropdown in Settings. Changes apply immediately.

## Managing themes

Themes can be managed in the preferences UI.

## Design document

For architectural rationale, deferred features (FOUC mitigation, per-journal themes, theme visualizer), and the original implementation plan, see [docs/designs/theming.md](designs/theming.md).
