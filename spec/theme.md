# Themes

Status: draft, version 1.

A theme is one JSON file, `<name>.theme.json`, that every Chronicles app can
read: a color palette and, optionally, the type notes are read and written
in. Which theme is active, and any changes the user makes to its type, are
device preferences: they are not library data, and export and sync never
carry them.

## File

```json
{
  "name": "Neofloss",
  "version": "1.0.0",
  "mode": "dark",
  "colors": { "background": "#1C1B1D", "foreground": "…", "…": "…" },
  "typography": { "body": "Mona Sans", "size": 17, "lineHeight": 1.5 }
}
```

| Field          | Required | Meaning                                                                    |
| -------------- | -------- | -------------------------------------------------------------------------- |
| `name`         | yes      | Non-blank string. Identifies the theme (compared case-insensitively).      |
| `version`      | yes      | Semver-like string (`^\d+\.\d+\.\d+`). Informational.                      |
| `mode`         | yes      | `light`, `dark`, or `both`.                                                |
| `inherentMode` | no       | `light` or `dark`: how bright the palette is, when it differs from `mode`. |
| `colors`       | yes      | One token set, or for `both` an object `{ "light": {…}, "dark": {…} }`.    |
| `typography`   | no       | Note type (below). Omitted fields take the defaults.                       |
| `codeTheme`    | no       | Legacy; ignored.                                                           |

Unknown fields, at any level, are ignored so older readers accept newer files.

### Variants

A theme has one variant per mode it supplies: `light` and `dark` themes have
one, `both` has two (built from `colors.light` and `colors.dark`). A variant
is dark when its mode is `dark`; for a single-mode theme, `inherentMode`
decides when present. Apps that pick a theme per system appearance list a
theme under each mode it has a variant for.

## Colors

Every token set supplies the required tokens. The derivable tokens are
optional; a missing one takes the value of the token it derives from.

Required: `background`, `foreground`, `foregroundStrong`, `muted`,
`mutedForeground`, `tooltip`, `tooltipForeground`, `primary`,
`primaryForeground`, `secondary`, `secondaryForeground`, `accent`,
`accentForeground`, `accentMuted`, `link`, `linkHover`, `destructive`,
`destructiveForeground`, `border`, `ring`, `tag`, `tagForeground`.

| Derivable                   | Defaults to           |
| --------------------------- | --------------------- |
| `card`                      | `background`          |
| `cardForeground`            | `foreground`          |
| `popover`                   | `background`          |
| `popoverForeground`         | `foreground`          |
| `input`                     | `border`              |
| `accentSecondary`           | `accent`              |
| `accentSecondaryForeground` | `accentForeground`    |
| `accentTertiary`            | `accent`              |
| `accentTertiaryForeground`  | `accentForeground`    |
| `tagSecondary`              | `secondary`           |
| `tagSecondaryForeground`    | `secondaryForeground` |
| `tagBorder`                 | `border`              |
| `tagSecondaryBorder`        | `border`              |
| `interactiveHover`          | `accent`              |

A color is a string in one of three forms:

- Hex: `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa` (case-insensitive).
- HSL function: `hsl(h, s%, l%)` or `hsl(h s% l%)`.
- Bare HSL triple: `h s% l%`.

`h` is in degrees, `s` and `l` are percentages; each may have a fraction.
Resolved, every channel is `round(v × 255)` (halves round up), written as
uppercase `#RRGGBB`, with an `AA` alpha byte only when alpha is below 1.

Token names map to CSS custom properties by kebab-casing: `primaryForeground`
→ `--primary-foreground`.

Jobs (what each token is for) are app guidance, not part of the format; the
desktop's are in its theming docs.

## Typography

```json
"typography": {
  "body": "Mona Sans",
  "heading": "Hubot Sans",
  "mono": "IBM Plex Mono",
  "size": 17,
  "lineHeight": 1.5
}
```

| Field        | Type   | Range     | Default         | Meaning                                   |
| ------------ | ------ | --------- | --------------- | ----------------------------------------- |
| `body`       | string | non-blank | `Mona Sans`     | Font family for note text.                |
| `heading`    | string | non-blank | `Hubot Sans`    | Font family for note titles and headings. |
| `mono`       | string | non-blank | `IBM Plex Mono` | Font family for code.                     |
| `size`       | number | 12 – 28   | `17`            | Body text size, in points (CSS px).       |
| `lineHeight` | number | 1.0 – 2.5 | `1.5`           | Baseline-to-baseline distance, × `size`.  |

- A family is a font name, or a generic one: `system-ui`, `ui-serif`,
  `ui-monospace`. An app that doesn't have a named font uses its default for
  that role; that is not an error.
- Typography applies to note text, reading and editing: body, headings, code,
  and the note's title. App chrome (lists, menus, settings) keeps the app's
  own type.
- `size` is the body size at the platform's default text size. Headings and
  code keep their proportions to it. Where the platform has a text-size
  setting (Dynamic Type), it scales the result.
- `lineHeight` is a target, not a pixel contract: each app tunes its own
  default rendering, and moving `lineHeight` by Δ from 1.5 moves body lines by
  Δ × `size`.

### Resolving

For each typography field, the effective value is the first present of:

1. the user's override on this device,
2. the active theme's `typography` field,
3. the default above.

Overrides are per field and apply to whichever theme is active, so a user who
prefers larger text keeps it across themes. Resetting clears every override.

## Theme sets

An app lists the themes it bundles plus the ones the user installed. A user
theme whose name matches a bundled theme replaces it in the list; installing
a theme with the name of an installed user theme replaces that file.
Installing validates first and refuses an invalid file with all of its
errors at once.

## Device preferences

Not part of the format; recorded so apps agree on what to offer:

- **Appearance:** one theme, or follow the system with a light theme and a
  dark theme (each chosen from the themes with that variant).
- **Typography overrides:** the fields above.

## Vectors

`vectors/theme/cases.json` is a list of cases:

```json
{ "name": "…", "input": { …theme file… }, "expected": { … } }
```

A valid case expects the resolved theme:

```json
{
  "variants": [{ "mode": "dark", "isDark": true, "colors": { "background": "#1C1B1D", … } }],
  "typography": { "body": "Mona Sans", "heading": "Hubot Sans", "mono": "IBM Plex Mono", "size": 17, "lineHeight": 1.5 }
}
```

`variants` lists `light` before `dark`; `colors` holds every required and
derivable token, resolved. `typography` is the theme's typography with no
user overrides.

An invalid case expects `{ "errors": [<path>, …] }`: the set of fields that
are wrong, in any order. A path is `name`, `version`, `mode`,
`inherentMode`, `colors`, `colors.<token>`, `colors.light`, `colors.dark`,
`colors.light.<token>`, `colors.dark.<token>`, `typography`, or
`typography.<field>`. A wrong `mode` stops validation (`colors` can't be
read without it). Message text is up to the app.

Implementations: the Swift app runs these vectors; the desktop validator
(`src/themes/schema.ts`) predates `typography` and ignores it.
