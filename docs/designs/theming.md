---
title: Theming
description: Proposal for theming in Chronicles
model: Gemini 3
---

# Theming Proposal

## Executive Summary

This document proposes a comprehensive theming system for Chronicles. While Chronicles currently supports some UI customizations (fonts, widths), it lacks a true multi-theme architecture. This proposal moves toward a system where color palettes (such as **Neofloss**) can be defined in external configuration files and swapped dynamically.

## 1. Critique of Existing Design Tokens

### Current State

Chronicles uses a hybrid approach to styling:

1.  **Functional Tokens:** Uses Shadcn/Radix-style functional names (`--background`, `--foreground`, `--primary`, etc.) defined in `src/index.css`.
2.  **Hardcoded Values:** These functional tokens have hardcoded HSL values inside `:root` and `.dark` selectors.
3.  **Dynamic Overrides:** A `StyleWatcher.tsx` component injects dynamic CSS variables for fonts and max-widths from the user's `preferences` store.

### Appraisal

- **Community Idioms:** The use of functional naming is highly idiomatic and aligns with the modern Tailwind/Shadcn ecosystem. It makes the codebase "theming-ready" at the component level.
- **The Bottleneck:** The primary issue is that **colors are not yet dynamic**. Unlike fonts and widths, which are reconciled at runtime, colors are "stuck" in the static CSS file.
- **Documentation:** Existing customization logic (widths, fonts) is documented in [docs/editor/styling.md](../editor/styling.md).

### Refactor vs. Long-term Needs

- **Refactor:** Moving the color values from `src/index.css` into a dynamic store is a necessary structural cleanup.
- **Long-term Need:** The ability to distinguish between "System" themes (Light/Dark) and "Custom" themes (Neofloss, Nord, Solarized) without bloating the CSS bundle.

## 2. Motivating Example: Neofloss

**Neofloss** is a high-contrast, warm-purple palette that serves as a primary motivator for this project. It represents a departure from standard "Black/White" UIs, utilizing deep charcoals (`#1C1B1D`) and electric cyans/magentas.

While Neofloss is the catalyst, the system should be generic enough to support any user-defined palette.

## 3. Proposed Theming System

### Config-Driven Themes

Themes should be stored as JSON or YAML files (e.g., `neofloss.theme.json`). This allows for:

- **Easy Sharing:** Users can share a single file to trade themes.
- **Simplicity:** No complex "Theme Builder" UI is required initially; editing a raw file is an acceptable power-user workflow.

### Theme Mapping System

The system should map a **Palette** (base colors) to **Functional Tokens** (UI roles).

**Example Mapping (Neofloss):**
| Functional Token | Palette Color | Value (Hex/HSL) |
| :--- | :--- | :--- |
| `--background` | `base03` | `#1C1B1D` |
| `--foreground` | `base2` | `#D8B2DE` |
| `--primary` | `magenta` | `#8B70DA` |
| `--accent` | `cyan` | `#60C2E0` |
| `--destructive` | `alert` | `#DA1173` |

### Implementation Steps

1.  **Define Theme Schema:** Create a TypeScript interface for the theme configuration.
2.  **Expand StyleWatcher:** Enhance `StyleWatcher.tsx` to ingest the active theme's color palette and set corresponding CSS variables on `document.documentElement`.
3.  **Preferences Update:** Add a `theme` field to the preferences store that points to a theme name or file path.
4.  **CSS Cleanup:** Remove hardcoded HSL values from `src/index.css`, replacing them with generic variable references (or keeping them as "System Default" fallbacks).

## 4. Addressing the Color Bottleneck

Colors are the hardest part of theming. To simplify this:

- **Visualizer:** The preferences UI should ideally show a small preview (swatches) of the current palette.
- **LLM Assistance:** We can provide a standard prompt for LLMs to "Translate a hex palette into a Chronicles theme JSON," significantly lowering the barrier for non-designers to create themes.

## 5. Open Questions

- **Native Modules:** Do native modules like `better-sqlite3` or `sharp` have any UI implications (e.g., error modals) that need theming?
- **Plugin Styles:** How do we ensure third-party Plate.js plugins adhere to the dynamic tokens? (Currently, most use Tailwind classes which should resolve correctly if variables are set at the root).

---

**Last Updated:** February 28, 2026

## 6. Contextual Theming: Per-Journal Themes

### The Concept

Journals in Chronicles are tied to physical directories. By co-locating a theme configuration file (e.g., `journal.theme.json`) within the journal's root directory, we can enable "Contextual Theming."

### Workflow

- **Detection:** When a journal is selected as "Active," the system attempts to read a local theme file from its path.
- **Precedence:**
  1. **Journal Theme** (Highest priority)
  2. \*\*Global User Preference
  3. **System Default** (Lowest priority)
- **Visual Context:** This allows a "Work" journal to have a professional, muted theme (e.g., Nord) while a "Personal" or "Creative" journal uses a high-energy theme (e.g., Neofloss).

### Implementation Challenges

- **Path Resolution:** The main process must expose the physical path of the active journal to the Renderer.
- **File Watching:** If a user edits the `journal.theme.json` directly on disk, the app should ideally reflect those changes immediately (HMR for themes).
- **Shared Assets:** We must decide if themes can reference local assets (fonts, background images) relative to the journal path.

## 7. Strategic Considerations

### Inherent Mode (Light vs. Dark)

Custom themes (like Neofloss) are typically designed for a specific "vibe" (usually Dark).

- **Theme Property:** The theme schema must include an `inherentMode: 'light' | 'dark'` property.
- **System Response:** This ensures native elements (scrollbars, context menus, dialogs) respond correctly to the theme's intended brightness even if the colors are custom.

### Avoiding Flash of Unstyled Content (FOUC)

Since `StyleWatcher.tsx` is a React component, there is a risk of a theme "flash" during the async loading of preferences.

- **Optimization:** Consider moving critical theme injection (background/foreground) into a blocking script in `index.html` or early in the Renderer initialization to ensure the first paint uses the correct colors.

### Color Spaces: Hex to OKLCH

While users find **Hex** easiest to read and edit in config files, Tailwind CSS v4 and modern browsers excel with **OKLCH** for programmatic harmony and wide-gamut support.

- **The Tool's Job:** The `ThemeManager` should ingest Hex from the JSON but provide OKLCH strings to the CSS variables where possible to improve rendering quality.

### Semantic State Colors

High-intensity themes like Neofloss require "on-brand" state colors. A standard green Success or yellow Warning may clash with a neon-purple aesthetic.

- **Design Token Iteration:** The theme schema must be expanded to include semantic tokens (`--success`, `--warning`, `--info`) so the entire app stays "in character."

### Fallback & Recovery Strategy

If a theme file is deleted, corrupted, or invalid:

- **Hardcoded Fallback:** The app must always have the standard Light/Dark themes available as a fail-safe.
- **User Notification:** If a custom theme fails, the app should revert to a safe default and notify the user with a pointer to the theme manager (for humans) or the file location (for power users).

## 8. Implementation Plan

Ordered task list for converting into GitHub issues. Items marked **[DEFERRED]** are out of scope for the initial implementation but tracked here for future work.

### Phase 1: Foundation

- **1. Audit and document the full token inventory**
  - Enumerate every CSS custom property in `src/index.css` across `:root` and `.dark` (~30 token/variant pairs)
  - Classify each as "required" (theme must specify) vs "derivable" (can be computed from other tokens, e.g. `--card` defaults to `--background`)
  - Document which tokens are light-only, dark-only, or shared (e.g. `--foreground-strong`, `--link`, `--accent-muted` only exist in `.dark` today)
  - Output: updated doc or issue with the full inventory, derivation rules, and any tokens that should be added/removed

- **2. Define the theme JSON schema and TypeScript interface**
  - Depends on: #1 (token inventory)
  - Define the `ThemeConfig` interface covering: `name`, `version`, `mode: 'light' | 'dark' | 'both'`, and all required color tokens in HSL or hex
  - Themes declare whether they are light, dark, or both. If "both", the theme must provide values for both modes
  - Derivation rules from #1 determine which fields are optional (with documented defaults)
  - Include a `validate(theme: unknown): { valid: boolean; errors: string[] }` function that returns semantically meaningful error messages (e.g. "missing required token --background", "invalid color value for --primary: 'notacolor'") so that LLMs and users can iterate on theme files
  - Output: `src/themes/schema.ts` with interface + validation function

### Phase 2: Runtime plumbing

- **3. Add theme storage and preferences wiring**
  - Depends on: #2 (schema)
  - Add a themes directory (default location TBD, e.g. `~/.chronicles/themes/` or within `settingsDir`)
  - Bundle the current light and dark color sets as `system-light.theme.json` and `system-dark.theme.json` (or as hardcoded defaults in code — the point is they become `ThemeConfig` objects)
  - Add `themeLightName` and `themeDarkName` fields to `IPreferences` — users can select different themes for light vs dark mode
  - When `darkMode` is toggled, the active theme switches between the two selections

- **4. Extend StyleWatcher to apply theme colors**
  - Depends on: #3 (preferences wiring)
  - Load the active `ThemeConfig` (resolved from preference name -> themes directory -> parsed JSON -> validated)
  - Apply all color tokens to `document.documentElement.style` via `setProperty`, same pattern as fonts/widths
  - On theme change (preference update or dark mode toggle), re-apply
  - Fallback: if the selected theme fails validation, revert to the system default and surface an error to the user

- **5. CSS cleanup: remove hardcoded color values from `src/index.css`**
  - Depends on: #4 (StyleWatcher applies colors)
  - Remove the hardcoded HSL values from `:root` and `.dark` in `src/index.css`
  - Keep them only as the "System" theme definitions (either as JSON files or as in-code defaults)
  - The CSS file should reference variables without providing fallback values (StyleWatcher is the source of truth)

### Phase 3: Theme management

- **6. Implement theme install/import flow**
  - Depends on: #2 (schema + validation)
  - Provide a way to "install" a theme: validate the file against the schema, copy it to the themes directory
  - Surface validation errors clearly so users (or LLMs generating themes) can fix issues
  - Can be a simple file-picker in preferences UI or a CLI/menu action — minimal UI is fine for v1

- **7. Preferences UI: theme selection**
  - Depends on: #3 (preferences wiring), #6 (install flow)
  - Add theme selection to the preferences panel: list installed themes, allow picking one for light mode and one for dark mode
  - Show the theme name and mode compatibility (`light`, `dark`, `both`)

### Phase 4: Polish & deferred items

- **8. [DEFERRED] FOUC mitigation**
  - Investigate injecting critical theme variables (background, foreground) from main process into `index.html` before React mounts
  - Requires main-process involvement in theme delivery — evaluate complexity vs. visual impact

- **9. [DEFERRED] Per-journal contextual themes**
  - Co-locate `journal.theme.json` in journal directories; override global theme when journal is active
  - Requires path resolution across process boundary, file watching, precedence rules
  - Revisit after global theming is stable

- **10. [DEFERRED] Theme visualizer / preview**
  - Swatch preview in preferences UI showing the active palette
  - Useful for authoring, but not required when themes are edited as JSON files

- **11. [DEFERRED] Cross-system theme conversion / generation**
  - Provide a documented spec + prompt template so an LLM can convert themes from other systems (VS Code, iTerm, etc.) into Chronicles format
  - The validation function from #2 is the key enabler — an LLM can iterate against it
  - Evaluate after the schema is finalized and real themes have been authored
