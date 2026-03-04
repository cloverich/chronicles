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

_Not yet implemented._

**Anticipated QA:** This is the issue where theme colors become visible. When it lands:

- All colors should look identical to current state (since the built-in themes reproduce the existing CSS values)
- Toggling dark mode should now go through the theme system rather than the `.dark` CSS class
- The 4 light-mode tokens noted above (`foregroundStrong`, `link`, `linkHover`, `accentMuted`) will become active — check links and strong text in light mode look right
- Any mismatch between the `builtins.ts` HSL values and the CSS originals will become visible as color shifts

## Issue #448 — CSS cleanup: remove hardcoded colors

_Not yet implemented._

**Anticipated QA:** After this, `src/index.css` should no longer contain color values in `:root` / `.dark`. The sole source of truth for colors becomes the theme system. Check that the app still renders correctly with no flash of unstyled/white content.
