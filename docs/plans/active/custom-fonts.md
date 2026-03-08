# Custom Fonts

Support user-installed fonts via a directory convention, mirroring how custom themes work.

## How it works

1. **Font directory:** `<settingsDir>/fonts/` — each subdirectory is a font family. Directory name = font family name used in CSS.

```
<settingsDir>/fonts/
  IBM Plex Serif/
    IBMPlexSerif-Regular.ttf
    IBMPlexSerif-Bold.ttf
    IBMPlexSerif-Italic.ttf
  Recursive/
    Recursive.woff2
```

2. **Accepted formats:** `.ttf`, `.otf`, `.woff2`

3. **Font loading:** On startup, scan the directory. For each subdirectory, generate `@font-face` rules and inject them via a `<style>` tag (same pattern as hljs theme CSS injection).

4. **Weight/style from filenames:** Parse common suffixes to set `font-weight` and `font-style` in the `@font-face` rule:

| Suffix                                   | Weight             | Style  |
| ---------------------------------------- | ------------------ | ------ |
| `-Thin`, `-Hairline`                     | 100                | normal |
| `-Light`                                 | 300                | normal |
| `-Regular`, (no suffix)                  | 400                | normal |
| `-Medium`                                | 500                | normal |
| `-SemiBold`                              | 600                | normal |
| `-Bold`                                  | 700                | normal |
| `-Black`, `-Heavy`                       | 900                | normal |
| `*Italic` (combined, e.g. `-BoldItalic`) | (from weight part) | italic |

Unrecognized → 400 normal.

5. **Variable fonts:** For known variable fonts (Mona Sans, Hubot Sans), use `font-weight: 200 900` in the `@font-face` rule.

## Bundled fonts

Mona Sans, Hubot Sans, and IBM Plex Mono stay in the app bundle (`src/assets/fonts/`), loaded via `src/fonts.css` as today. They always appear in the dropdown.

## Font selection UI

The dropdown shows:

- Bundled fonts (Mona Sans, Hubot Sans, IBM Plex Mono)
- User-installed fonts (from `<settingsDir>/fonts/`)
- Generic families: `sans-serif`, `serif`, `monospace`

The current list of guessed system fonts (Arial, Georgia, Consolas, etc.) is removed.

"Open fonts folder" link in preferences, same as themes.

## Fallback stacks

Default font stacks use macOS system fonts with standard web fallbacks:

```
sans-serif:  -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif
serif:       "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif
monospace:   "SF Mono", SFMono-Regular, Menlo, Monaco, Consolas, monospace
```

When a user selects a custom font, it gets set as the CSS variable value with no extra fallback chain — if the font isn't found, the CSS variable's initial value (defined in `src/index.css`) provides the fallback, which is the default stack above.

## What this does NOT cover

- **System font enumeration** — detecting fonts installed on the OS. Tracked in #455.
- **Font preview** — showing what a font looks like before selecting it.
- **Per-weight customization** — users pick a family, the app uses regular/bold/italic as needed.
