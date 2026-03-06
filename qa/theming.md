# Theming QA

Running QA checklist for the theming epic (#443). Updated as each issue lands.

Each section covers: what changed, what to verify in the app, and what should NOT have changed (regression checks).

---

## Issue #444 — Token inventory audit

**What landed:** `docs/designs/theming.md` updated with full token inventory. No code changes.

**Nothing to QA** — documentation only.

---

## Issue #445 — Theme JSON schema and TypeScript interface

**Files changed:**

- `src/themes/schema.ts` (new) — `ThemeConfig` interface, `validate()` function
- `src/themes/schema.test.ts` (new) — 400 lines of validation tests

**What to verify:**

- [ ] App starts normally — these files are not imported by anything yet, so there should be zero runtime impact

**Regression check:**

- [ ] No visible changes to the app whatsoever. Schema is inert until wired in.

---

## Issue #446 — Theme storage and preferences wiring

**Files changed:**

- `src/themes/builtins.ts` (new) — `systemLightTheme`, `systemDarkTheme` as `ThemeConfig` objects; `resolveBuiltinTheme()`, `resolveActiveThemeName()` helpers
- `src/electron/settings.ts` — Added `themeLightName` and `themeDarkName` to `IPreferences` (defaults: `"System Light"`, `"System Dark"`)
- `src/hooks/stores/preferences.ts` — New fields wired as MobX observables + synced to electron-store
- `src/electron/userFilesInit.ts` — Creates `<settingsDir>/themes/` directory on startup

**What to verify:**

- [ ] App starts without errors
- [ ] `themes/` directory is created inside your settings directory (check `~/Library/Application Support/Chronicles/themes/` or wherever your `settingsDir` points)
- [ ] Open DevTools → Application → Local Storage (or check `settings.json` on disk): `themeLightName` should be `"System Light"` and `themeDarkName` should be `"System Dark"` after first launch
- [ ] Toggling dark mode still works exactly as before — the new preference fields exist but nothing reads them for rendering yet

**Regression check:**

- [ ] All existing colors in both light and dark mode are identical to before. The built-in themes are defined but not yet applied — colors still come from the hardcoded CSS in `src/index.css`.
- [ ] Font preferences, max-width preferences, and font-size preferences still work
- [ ] No console errors related to themes on startup

**Notable decisions:**

- Light theme needed 4 tokens that only existed in `.dark` CSS (`foregroundStrong`, `link`, `linkHover`, `accentMuted`). Chosen values:
  - `foregroundStrong`: `hsl(222.2 84% 3%)` — slightly darker than foreground
  - `link`: `hsl(224 100% 40%)` — standard blue
  - `linkHover`: `hsl(224 100% 30%)` — darker blue
  - `accentMuted`: `hsl(173 40% 60%)` — desaturated accent
- These values will become visible when #447 (StyleWatcher) starts applying theme colors. Worth eyeballing at that point.
- HSL values in builtins use space-separated format (`hsl(173 80% 40%)`) even where the CSS used comma-separated (`hsl(173, 80%, 40%)`). Both are valid CSS and valid per the schema.

---

## Issue #447 — Extend StyleWatcher to apply theme colors

**Files changed:**

- `src/views/StyleWatcher.tsx` — New MobX reaction applying theme color tokens as CSS custom properties. Resolves effective mode, picks active theme, applies all required + derivable tokens via `setProperty`. Listens for OS dark mode changes.
- `src/themes/schema.ts` — Exported `REQUIRED_TOKENS`, `DERIVABLE_TOKENS`, and `CSS_NAME` (previously private)

**What to verify:**

- [ ] App starts without errors in both light and dark mode
- [ ] **Dark mode colors** should look identical to before — the built-in `System Dark` theme reproduces the exact CSS values from `.dark`
- [ ] **Light mode colors** should look identical to before for existing tokens. However, 4 tokens are now active that previously had no light-mode value:
  - `--foreground-strong`: check bold/strong text — should be very slightly darker than body text
  - `--link` / `--link-hover`: check hyperlinks — should be a standard blue (`hsl(224 100% 40%)` / `hsl(224 100% 30%)`)
  - `--accent-muted`: check any muted accent usage — should be a desaturated teal
- [ ] Toggle dark mode in preferences — colors should switch smoothly without reload
- [ ] If your OS is set to "system" dark mode: toggle your OS appearance and verify the app follows
- [ ] Open DevTools console — no errors about themes on startup or mode toggle

**Regression check:**

- [ ] Font preferences, max-width, and font-size preferences still work (StyleWatcher reactions unchanged)
- [ ] Sidebar, editor, tag chips, buttons, destructive actions all render correctly in both modes
- [ ] No flash of wrong colors on startup (CSS still provides initial values; StyleWatcher applies on top)

**How it works (for debugging):**

The new reaction in StyleWatcher watches `darkMode`, `themeLightName`, and `themeDarkName`. On any change (or initial mount), it:
1. Resolves "system" → effective "light"/"dark" via `matchMedia`
2. Picks the theme name via `resolveActiveThemeName()`
3. Loads the ThemeConfig via `window.chronicles.loadThemeByName()` — checks builtins first, then scans user themes directory
4. Applies all color tokens via `document.documentElement.style.setProperty()`
5. Falls back to the system default theme with `console.error` if the named theme is not found

## Issue #448 — CSS cleanup: remove hardcoded colors

**Files changed:**

- `src/index.css` — Removed 92 lines: all hardcoded HSL color values from `:root` (36 lines) and the entire `.dark` block (56 lines)

**What to verify:**

- [ ] App starts and renders correctly — StyleWatcher is now the only source of color values
- [ ] **Both light and dark mode** look correct — no missing colors, no white flashes, no unstyled elements
- [ ] The `@custom-variant dark` Tailwind directive is still functional — dark-mode Tailwind classes (e.g., `dark:bg-*`) should still work
- [ ] The `@theme` block referencing `var(--*)` tokens still works — Tailwind utility classes like `bg-background`, `text-foreground` should resolve correctly

**Regression check:**

- [ ] Font variables, max-width variables, `--radius`, `--titlebar-height` all unchanged
- [ ] No Tailwind build errors (the `@theme` block only has `var()` references, not hardcoded values)
- [ ] Scrollbar styling, selection highlight, border colors all correct

**Known issue — dark FOUC on startup:**

Confirmed: there is a brief dark flash on startup. With CSS no longer providing initial color values, there's a window between first paint and StyleWatcher mounting where colors are undefined (defaulting to dark/black). This is the FOUC described in the design doc (Section 7) — tracked as a deferred item in the epic. Low priority for now.

---

## Issue #449 — Implement theme install/import flow

**Files changed:**

- `src/themes/importer.ts` (new) — `importThemeFile(filePath, themesDir)`: reads file, parses JSON, validates via `validate()`, copies to themes dir
- `src/electron/index.ts` — New `select-theme-file` IPC handler for file picker dialog (filters to `.json`)
- `src/preload/utils.electron.tsx` — New `selectThemeFile()` IPC helper + re-exports `importThemeFile`
- `src/preload/index.ts` — Exposed `selectThemeFile` and `importThemeFile` on `window.chronicles`
- `src/views/preferences/index.tsx` — "Import Theme" button in Appearance section with success/error toasts

**What to verify:**

- [ ] Open Settings → Appearance: "Import Theme" button appears with description text
- [ ] Click "Import Theme" — file picker dialog opens, filtered to `.json` files
- [ ] Select a valid `.theme.json` file — success toast shows theme name, file copied to `<settingsDir>/themes/`
- [ ] Select an invalid JSON file (e.g., a random `.json` with wrong structure) — error toast shows specific validation errors
- [ ] Cancel the file picker — no error, no toast, button returns to normal state
- [ ] Verify the imported file appears in `<settingsDir>/themes/` directory on disk

**Regression check:**

- [ ] Existing "Change directory" file picker still works
- [ ] All other preferences sections unaffected
- [ ] No console errors on startup

**Note:** Installed themes won't be selectable yet — that's #450 (theme selection UI). For now, just verify the file lands in the themes directory.

---

## Issue #450 — Preferences UI: theme selection

**Files changed:**

- `src/themes/loader.ts` (new) — `listAvailableThemes(themesDir)`: returns builtins + validated installed themes as `ThemeListEntry[]`
- `src/preload/utils.electron.tsx` — Re-exports `listAvailableThemes`
- `src/preload/index.ts` — Exposed `listAvailableThemes` on `window.chronicles`
- `src/views/preferences/index.tsx` — Replaced static "Theme: Default" with Light Theme and Dark Theme dropdowns

**What to verify:**

- [ ] Settings → Appearance: "Light Theme" and "Dark Theme" dropdowns visible
- [ ] Light Theme dropdown shows "System Light" (and any installed themes with mode `light` or `both`)
- [ ] Dark Theme dropdown shows "System Dark" (and any installed themes with mode `dark` or `both`)
- [ ] Change light theme selection → colors update immediately (no restart needed)
- [ ] Change dark theme selection → toggle to dark mode → new theme is active
- [ ] **End-to-end test:** Import a custom theme file (#449), close/reopen preferences, it appears in the dropdown, select it, colors change

**Regression check:**

- [ ] Dark mode toggle (Appearance dropdown) still works
- [ ] Import Theme button still works
- [ ] Font, font-size, max-width preferences unaffected

**~~Known limitation~~ Fixed:**

~~After importing a theme while the preferences panel is open, the new theme won't appear in the dropdowns until you close and reopen preferences.~~ Import now calls `refreshThemeList()` after success, so the dropdown updates immediately.

---

## QA round 1 — Bugfixes from Neofloss testing

Testing with a custom dark theme (Neofloss) revealed several issues. All fixed in a single pass.

### Bug: User-installed themes not applied

**Root cause:** `StyleWatcher` called `resolveBuiltinTheme()` which only checked the hardcoded `BUILTIN_THEMES` map. User-installed themes were never loaded from disk — selecting one returned `undefined`, logged an error, and fell back to the system default.

**Fix:** Added `loadThemeByName(name, themesDir)` to `src/themes/loader.ts` that checks builtins first, then scans the user themes directory. `StyleWatcher` now calls this via `window.chronicles.loadThemeByName()`.

**Files changed:** `src/themes/loader.ts`, `src/preload/utils.electron.tsx`, `src/preload/index.ts`, `src/views/StyleWatcher.tsx`

### Bug: Misuse of `text-accent-foreground` on non-accent surfaces

**Root cause:** Several components used `text-accent-foreground` (designed for text on `bg-accent` surfaces) on `bg-secondary` or `bg-background` surfaces. With Neofloss, `accentForeground` is near-black `#1C1B1D` — invisible on dark backgrounds.

**Fixes:**

| Component | File | Was | Now |
|---|---|---|---|
| Titlebar | `src/titlebar/macos.tsx:14` | `text-accent-foreground` | `text-secondary-foreground` |
| Date group headings | `src/views/documents/index.tsx:112` | `text-accent-foreground` | `text-foreground-strong` |
| Search input text | `src/components/tag-input/TagInput.tsx:159` | `text-tag-foreground bg-background` | `text-inherit placeholder:text-muted-foreground bg-transparent` |
| Search input container | `src/components/tag-input/TagInput.tsx:144` | `bg-background` | `bg-transparent` + `border-muted-foreground/30` |
| Search dropdown label | `src/components/tag-input/TagInput.tsx:262` | `text-foreground` (didn't flip on hover) | `text-muted-foreground group-hover/item:text-inherit` |

### Enhancement: Preferences UI improvements

**Changes:**

- **Reordered Appearance section:** Appearance (Light/Dark/System) now first, then Light Theme, Dark Theme, Import Theme
- **Installed Themes list:** Custom themes shown with name, mode badge, and trash icon to delete. Deleting an active theme resets to system default.
- **Open themes folder:** Clickable link at bottom of Appearance section opens themes directory in Finder (`shell.openPath` via IPC)
- **Import live-refresh:** Theme list refreshes immediately after successful import (#453 fixed)

**Files changed:** `src/views/preferences/index.tsx`, `src/themes/loader.ts` (added `deleteThemeByName`), `src/electron/index.ts` (added `open-path` IPC), `src/preload/utils.electron.tsx`, `src/preload/index.ts`

**What to verify:**

- [ ] Select a custom theme → colors apply immediately
- [ ] Titlebar icons visible in both light and dark custom themes
- [ ] Search input text and placeholder visible in titlebar
- [ ] Search dropdown: unhovered labels are muted, hovered labels match accent foreground
- [ ] Date group headings visible on page background
- [ ] Settings → Appearance: order is Appearance, Light Theme, Dark Theme, Import Theme
- [ ] Import a theme → it appears in the dropdown immediately
- [ ] Installed themes list shows custom themes with delete button
- [ ] Delete a theme → toast, removed from list, resets to system default if active
- [ ] "Open themes folder" opens Finder to the themes directory
- [ ] All above work correctly with System Light theme too (regression)

---

## Gaps and follow-ups

### No CLI theme validation

**Problem:** The `validate()` function lives in `src/themes/schema.ts` (TypeScript). There's no built `dist/` output for it and no `tsx` dev dependency. You cannot validate a theme file outside the running Electron app. This complicates theme authoring — the design doc envisions LLMs iterating against validation errors, but right now the only way to see errors is to import a bad file through the app UI.

**Proposed solutions (ranked):**

1. **`yarn validate-theme <path>`** — Add a script to `package.json` that runs a small wrapper. Most ergonomic. Requires either `tsx` as a devDep or a pre-built JS entrypoint for the schema module.
2. **Standalone script via test runner** — `scripts/validate-theme.ts` run via `node --test` or `node --import tsx`. The project's test infra already handles TS imports, so this may work with zero new deps. Slightly less discoverable.
3. **Test-based validation** — A test that globs for `*.theme.json` files and validates them. Works with existing infra but bad UX for interactive authoring.

**Recommendation:** Option 2 first (zero new deps, immediate value), then wrap it as option 1 in `package.json` for discoverability. Tracked as a follow-up issue.
