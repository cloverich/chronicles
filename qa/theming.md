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
3. Looks up the ThemeConfig via `resolveBuiltinTheme()`
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
