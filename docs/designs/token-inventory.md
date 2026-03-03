---
title: CSS Token Inventory
description: Audit of all color CSS custom properties in Chronicles for theming purposes
related: theming.md
---

# CSS Token Inventory

Audit of every color CSS custom property defined in `src/index.css` across `:root` and `.dark`
selectors. This document is a prerequisite for defining a theme schema (see `theming.md`, Section 8,
Item 1).

## Scope

Files examined:

- `src/index.css` — primary source of all custom properties (`:root` and `.dark`)
- `src/fonts.css` — font-face declarations only, no custom properties
- `src/prism-code-theme.css` — hardcoded HSL values for syntax highlighting, no custom properties

The `@theme` block in `src/index.css` bridges the raw tokens into Tailwind's color namespace
(`--color-*`). These aliases are not independent tokens; they are references and are noted where
relevant.

---

## Token Table

Each row covers a semantic color token. Columns:

- **Token** — CSS custom property name as defined in `:root` or `.dark`
- **Presence** — `shared` (both `:root` and `.dark`), `light-only` (`:root` only), `dark-only`
  (`.dark` only)
- **Classification** — `required` (a theme must supply a value) vs `derivable` (can be computed
  from another token with a documented rule)
- **Derivation rule** — only populated for `derivable` tokens; describes the default calculation
- **Notes** — usage observations, anomalies, open questions

### Surface & Text

| Token                    | Presence | Classification | Derivation rule                           | Notes                                                                                                 |
| :----------------------- | :------- | :------------- | :---------------------------------------- | :---------------------------------------------------------------------------------------------------- |
| `--background`           | shared   | required       | —                                         | Page/app background. Used via `bg-background` on `<body>`. Tailwind alias: `--color-background`.     |
| `--foreground`           | shared   | required       | —                                         | Default body text color. Tailwind alias: `--color-foreground`.                                        |
| `--foreground-strong`    | dark-only | required      | —                                         | High-contrast text variant. Used for `<strong>`, `<code>`, hover states, and labels in preferences. Missing from `:root`. |
| `--muted`                | shared   | required       | —                                         | Subtle background surfaces (sidebar items, inputs). Tailwind alias: `--color-muted`.                 |
| `--muted-foreground`     | shared   | required       | —                                         | De-emphasized text. Used for scrollbar thumb, code backtick decorators. Tailwind alias: `--color-muted-foreground`. |

### Card & Popover

| Token                    | Presence | Classification | Derivation rule                           | Notes                                                                                                 |
| :----------------------- | :------- | :------------- | :---------------------------------------- | :---------------------------------------------------------------------------------------------------- |
| `--card`                 | shared   | derivable      | Default to `--background`                 | In both `:root` and `.dark`, `--card` equals `--background`. Tailwind alias: `--color-card`.         |
| `--card-foreground`      | shared   | derivable      | Default to `--foreground`                 | In both `:root` and `.dark`, `--card-foreground` equals `--foreground`. Tailwind alias: `--color-card-foreground`. |
| `--popover`              | shared   | derivable      | Default to `--background`                 | In both `:root` and `.dark`, `--popover` equals `--background`. Tailwind alias: `--color-popover`.   |
| `--popover-foreground`   | shared   | derivable      | Default to `--foreground`                 | In both `:root` and `.dark`, `--popover-foreground` equals `--foreground`. Tailwind alias: `--color-popover-foreground`. |
| `--tooltip`              | shared   | required       | —                                         | In `:root` equals `--foreground`; in `.dark` equals `--background`. Intentional inversion — must be specified per theme. Tailwind alias: `--color-tooltip`. |
| `--tooltip-foreground`   | shared   | required       | —                                         | In `:root` equals `--background`; in `.dark` equals a near-white. Intentional inversion. Tailwind alias: `--color-tooltip-foreground`. |

### Primary & Secondary

| Token                        | Presence | Classification | Derivation rule | Notes                                                                                             |
| :--------------------------- | :------- | :------------- | :-------------- | :------------------------------------------------------------------------------------------------ |
| `--primary`                  | shared   | required       | —               | Primary action color (buttons, prominent elements). Tailwind alias: `--color-primary`.            |
| `--primary-foreground`       | shared   | required       | —               | Text/icon on primary backgrounds. Tailwind alias: `--color-primary-foreground`.                   |
| `--secondary`                | shared   | required       | —               | Secondary surface color (sidesheets, secondary buttons). Tailwind alias: `--color-secondary`.     |
| `--secondary-foreground`     | shared   | required       | —               | Text on secondary surfaces. Tailwind alias: `--color-secondary-foreground`.                       |

### Accent

| Token                              | Presence  | Classification | Derivation rule                          | Notes                                                                                                                 |
| :--------------------------------- | :-------- | :------------- | :--------------------------------------- | :-------------------------------------------------------------------------------------------------------------------- |
| `--accent`                         | shared    | required       | —                                        | Brand accent color (teal/cyan). Identical value (`hsl(173, 80%, 40%)`) in both `:root` and `.dark`. Tailwind alias: `--color-accent`. Used for `::selection` background. |
| `--accent-foreground`              | shared    | required       | —                                        | Text on accent backgrounds. Light: dark gray; dark: light teal. Tailwind alias: `--color-accent-foreground`.          |
| `--accent-secondary`               | shared    | derivable      | Default to `--accent`                    | Currently identical to `--accent` in both modes. Tailwind alias: `--color-accent-secondary`.                          |
| `--accent-secondary-foreground`    | shared    | derivable      | Default to `--accent-foreground` in dark | Light: `hsl(168, 83%, 89%)`; dark: `hsl(168, 83%, 89%)` — same. Tailwind alias: `--color-accent-secondary-foreground`. |
| `--accent-tertiary`                | shared    | derivable      | Default to `--accent`                    | Currently identical to `--accent` in both modes. Tailwind alias: `--color-accent-tertiary`.                           |
| `--accent-tertiary-foreground`     | shared    | derivable      | Default to `--accent-foreground` in dark | Currently identical to `--accent-secondary-foreground`. Tailwind alias: `--color-accent-tertiary-foreground`.          |
| `--accent-muted`                   | dark-only | required       | —                                        | Lower-saturation accent for borders and hover states. Used on titlebar, sidesheets, buttons, card borders. No light-mode counterpart defined. |

### Link

| Token          | Presence  | Classification | Derivation rule | Notes                                                                                             |
| :------------- | :-------- | :------------- | :-------------- | :------------------------------------------------------------------------------------------------ |
| `--link`       | dark-only | required       | —               | Hyperlink color. Used via `text-link` in `NoteLinkElement.tsx`. No light-mode value defined. Tailwind alias: `--color-link`. |
| `--link-hover` | dark-only | required       | —               | Link hover state. Used via `hover:text-link-hover`. No light-mode value defined. Tailwind alias: `--color-link-hover`. |

### Destructive

| Token                      | Presence | Classification | Derivation rule | Notes                                                                            |
| :------------------------- | :------- | :------------- | :-------------- | :------------------------------------------------------------------------------- |
| `--destructive`            | shared   | required       | —               | Danger/error state color. Tailwind alias: `--color-destructive`.                 |
| `--destructive-foreground` | shared   | required       | —               | Text on destructive backgrounds. Tailwind alias: `--color-destructive-foreground`. |

### Borders & Inputs

| Token     | Presence | Classification | Derivation rule         | Notes                                                                                            |
| :-------- | :------- | :------------- | :---------------------- | :----------------------------------------------------------------------------------------------- |
| `--border` | shared  | required       | —                       | Default border color; applied globally via `@apply border-border`. Tailwind alias: `--color-border`. |
| `--input`  | shared  | derivable      | Default to `--border`   | In both modes, `--input` equals `--border`. Tailwind alias: `--color-input`.                     |
| `--ring`   | shared  | required       | —                       | Focus ring color. Tailwind alias: `--color-ring`.                                                |

### Tag

| Token                      | Presence | Classification | Derivation rule | Notes                                                                                                                                                    |
| :------------------------- | :------- | :------------- | :-------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--tag`                    | shared   | required       | —               | Tag chip background. Used via `bg-tagg` (note double-g Tailwind alias). Tailwind alias: `--color-tagg`.                                                  |
| `--tag-foreground`         | shared   | required       | —               | Text on tag chips. Tailwind alias: `--color-tagg-foreground`.                                                                                            |
| `--tag-secondary`          | shared   | derivable      | Default to `--secondary` | In `:root` `hsl(217.2 32.6% 17.5%)` (matches dark `--secondary`); in `.dark` same value. This token appears to be unused in component code — candidate for removal. |
| `--tag-secondary-foreground` | shared | derivable    | Default to `--secondary-foreground` | Same value in both modes: `hsl(210 40% 98%)`. Unused in component code — candidate for removal alongside `--tag-secondary`.                |
| `--tag-muted`              | neither  | —              | —               | Referenced in `@theme` as `var(--tag-muted)` but never defined in `:root` or `.dark`. Resolves to empty/invalid. Dead reference.                         |
| `--tag-muted-foreground`   | neither  | —              | —               | Same as `--tag-muted` — referenced in `@theme` but never defined anywhere. Dead reference.                                                               |

---

## Asymmetries Between `:root` and `.dark`

The following tokens are present in one selector but not the other:

| Token                 | Present in | Absent from | Impact                                                                                                                                                                      |
| :-------------------- | :--------- | :---------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--foreground-strong` | `.dark`    | `:root`     | Used in component CSS (`.slate-bold`, `.slate-code`) and multiple Tailwind classes (`text-foreground-strong`). In light mode, these elements will inherit browser default or parent color — no explicit high-contrast variant. |
| `--link`              | `.dark`    | `:root`     | Used in `NoteLinkElement.tsx` via `text-link`. In light mode the Tailwind class resolves to a missing variable, rendering transparent or inheriting. Links will be unstyled in light mode. |
| `--link-hover`        | `.dark`    | `:root`     | Same problem as `--link`. Hover state has no light-mode color.                                                                                                              |
| `--accent-muted`      | `.dark`    | `:root`     | Used in titlebar, sidesheets, button variants, and card borders via `border-accent-muted`. In light mode these borders/backgrounds have no color value.                     |

---

## Tailwind `@theme` Anomalies

The `@theme` block exposes tokens to Tailwind's color utility system using `--color-*` aliases.
Two issues were found:

1. **Double-g typo** — The `--tag` family is aliased as `--color-tagg` (double-g). Component code
   uses `bg-tagg`, `text-tagg-foreground` matching this alias. The underlying token name (`--tag`)
   is correct; the typo is isolated to the Tailwind alias layer.

2. **Dead references** — `--color-tagg-muted` and `--color-tagg-muted-foreground` reference
   `var(--tag-muted)` and `var(--tag-muted-foreground)` respectively, but neither `--tag-muted` nor
   `--tag-muted-foreground` is defined anywhere in `:root` or `.dark`. These are dead references
   that resolve to nothing.

---

## Complete Token Reference

Summary table for quick lookup during schema definition:

| Token                          | `:root` | `.dark` | Required / Derivable   |
| :----------------------------- | :-----: | :-----: | :--------------------- |
| `--background`                 | yes     | yes     | required               |
| `--foreground`                 | yes     | yes     | required               |
| `--foreground-strong`          | **no**  | yes     | required               |
| `--muted`                      | yes     | yes     | required               |
| `--muted-foreground`           | yes     | yes     | required               |
| `--card`                       | yes     | yes     | derivable = `--background` |
| `--card-foreground`            | yes     | yes     | derivable = `--foreground` |
| `--popover`                    | yes     | yes     | derivable = `--background` |
| `--popover-foreground`         | yes     | yes     | derivable = `--foreground` |
| `--tooltip`                    | yes     | yes     | required               |
| `--tooltip-foreground`         | yes     | yes     | required               |
| `--primary`                    | yes     | yes     | required               |
| `--primary-foreground`         | yes     | yes     | required               |
| `--secondary`                  | yes     | yes     | required               |
| `--secondary-foreground`       | yes     | yes     | required               |
| `--accent`                     | yes     | yes     | required               |
| `--accent-foreground`          | yes     | yes     | required               |
| `--accent-secondary`           | yes     | yes     | derivable = `--accent` |
| `--accent-secondary-foreground` | yes    | yes     | derivable = `--accent-foreground` |
| `--accent-tertiary`            | yes     | yes     | derivable = `--accent` |
| `--accent-tertiary-foreground` | yes     | yes     | derivable = `--accent-foreground` |
| `--accent-muted`               | **no**  | yes     | required               |
| `--link`                       | **no**  | yes     | required               |
| `--link-hover`                 | **no**  | yes     | required               |
| `--destructive`                | yes     | yes     | required               |
| `--destructive-foreground`     | yes     | yes     | required               |
| `--border`                     | yes     | yes     | required               |
| `--input`                      | yes     | yes     | derivable = `--border` |
| `--ring`                       | yes     | yes     | required               |
| `--tag`                        | yes     | yes     | required               |
| `--tag-foreground`             | yes     | yes     | required               |
| `--tag-secondary`              | yes     | yes     | derivable = `--secondary` |
| `--tag-secondary-foreground`   | yes     | yes     | derivable = `--secondary-foreground` |
| `--tag-muted`                  | **no**  | **no**  | undefined — dead reference |
| `--tag-muted-foreground`       | **no**  | **no**  | undefined — dead reference |

**Totals:** 34 entries total; 20 required, 8 derivable, 2 undefined/dead, 4 light-only absent
(asymmetric dark-only tokens that are actively used).

---

## Recommendations

### Tokens to Add

The four dark-only tokens that are consumed by component code must also be defined for light mode.
Omitting them means those components are broken (transparent or no-op) when the light theme is
active.

| Token to Add           | Suggested Light Value                          | Rationale                                               |
| :--------------------- | :--------------------------------------------- | :------------------------------------------------------ |
| `--foreground-strong`  | Darker variant of `--foreground`, e.g. `hsl(222.2 84% 4.9%)` (= `:root` `--foreground`) | Already the maximum-contrast text in light; can match `--foreground` or slightly darker. |
| `--accent-muted`       | Lighter tint of `--accent`, e.g. `hsl(173, 40%, 80%)` | Used for borders/backgrounds; needs to be visible against `--background` white. |
| `--link`               | Standard hyperlink blue, e.g. `hsl(221, 83%, 53%)` | Note link elements need a color in light mode.          |
| `--link-hover`         | Slightly darker than `--link`, e.g. `hsl(221, 83%, 43%)` | Hover state for note links.                             |

### Tokens to Remove

| Token to Remove              | Reason                                                                                      |
| :--------------------------- | :------------------------------------------------------------------------------------------ |
| `--tag-muted`                | Defined nowhere; only appears as a dead reference in the `@theme` Tailwind alias. Remove both the alias and the concept until there is a real use case. |
| `--tag-muted-foreground`     | Same as above.                                                                              |
| `--tag-secondary`            | Currently equals `--secondary` in both modes; no component uses `text-tagg-secondary` or `bg-tagg-secondary`. If unused, remove to simplify the token set. |
| `--tag-secondary-foreground` | Same as above; no observed usage in component code.                                         |

### Tokens to Consolidate (Optional, Lower Priority)

- `--accent-secondary` and `--accent-tertiary` are identical to `--accent` in both modes. They add
  conceptual slots without current differentiation. If there is no roadmap use for them, consider
  collapsing them into `--accent` until a distinction is needed.
- `--card` and `--popover` are always `--background`; `--card-foreground` and `--popover-foreground`
  are always `--foreground`. These aliases are useful for Shadcn component compatibility but can
  default to the parent token in a theme schema rather than requiring explicit values.

### Minimum Required Token Set for a Theme Schema

Based on the analysis above, a theme definition must supply at minimum these 20 tokens:

```
--background
--foreground
--foreground-strong
--muted
--muted-foreground
--tooltip
--tooltip-foreground
--primary
--primary-foreground
--secondary
--secondary-foreground
--accent
--accent-foreground
--accent-muted
--link
--link-hover
--destructive
--destructive-foreground
--border
--ring
--tag
--tag-foreground
```

All other tokens in `src/index.css` can be derived from this set using the rules documented in the
table above.

---

## Syntax Highlighting Note

`src/prism-code-theme.css` uses only hardcoded HSL values (no CSS custom properties). It implements
the Atom One Light theme unconditionally and does not adapt to dark mode or user themes. This is
out of scope for the current theming schema but is a notable gap — code blocks will always appear
light-themed regardless of the active palette. A future token family (e.g. `--syntax-bg`,
`--syntax-fg`, `--syntax-keyword`) would be needed to address this.
