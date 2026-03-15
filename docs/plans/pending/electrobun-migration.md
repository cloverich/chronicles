# Electrobun Migration Plan

## Context

Chronicles needs a CLI callable by LLMs. Electron can't serve as a CLI runtime — it's too heavy and not designed for it. Running the backend on Node.js directly requires transpilation and end users need Node installed. Bun solves this: `bun build --compile` produces a standalone binary with ~50ms startup and built-in SQLite.

Rather than building a separate CLI-on-Bun alongside an Electron desktop app, we migrate the desktop app to Electrobun (Bun + system webview). This gives us:

- Unified runtime for both desktop app and future CLI
- `bun:sqlite` replaces `better-sqlite3` (no native rebuild headaches)
- Typed end-to-end RPC replaces the preload/contextBridge boilerplate
- ~12MB bundles vs ~100MB, <50ms startup vs 1-2s
- The Vite migration already proved the UI cleaves cleanly

**Fallback:** If Electrobun doesn't work out, the architectural cleanup (better seams, documented interfaces) makes a Swift migration easier, not harder.

---

## Docs to Acquire

LLM agents need these docs in-repo for consistent context. Suggested location: `docs/vendor/`

### Required (fetch before starting)

| Doc                           | Source                                                   | Suggested fetch method             |
| ----------------------------- | -------------------------------------------------------- | ---------------------------------- |
| Electrobun Getting Started    | `https://electrobun.dev/docs/getting-started`            | `curl` or browser save-as-markdown |
| Electrobun RPC                | `https://electrobun.dev/docs/rpc`                        | Same                               |
| Electrobun BrowserView        | `https://electrobun.dev/docs/api/browser-view`           | Same                               |
| Electrobun Dialogs/Menus      | `https://electrobun.dev/docs/api/` (native APIs section) | Same                               |
| Electrobun Project Structure  | `https://electrobun.dev/docs/project-structure`          | Same                               |
| Electrobun Build & Distribute | `https://electrobun.dev/docs/build-and-distribute`       | Same                               |
| `bun:sqlite` API              | `https://bun.sh/docs/api/sqlite`                         | Same                               |
| Bun Node.js compat            | `https://bun.sh/docs/runtime/nodejs-apis`                | Same                               |

**Fetch approach options:**

1. **Browser extension** (e.g., MarkDownload) — save each page as .md, drop into `docs/vendor/electrobun/` and `docs/vendor/bun/`
2. **`readable`/`readability-cli`** — `npx @nicolo-ribaudo/readability-cli <url> > file.md`
3. **Manual copy-paste** — fastest for 6-8 pages, paste into .md files
4. **Jina Reader** — `curl https://r.jina.ai/<url>` returns markdown

### Nice to have

- Electrobun examples/samples repo (if one exists)
- Any migration guides from Electron → Electrobun

---

## Current Electron Integration Points (Complete Inventory)

### `window.chronicles` API (14 methods — the entire renderer↔backend contract)

| Method                              | Category   | What it does                                                           |
| ----------------------------------- | ---------- | ---------------------------------------------------------------------- |
| `getClient()`                       | Core       | Returns IClient singleton (journals, docs, tags, files, indexer, etc.) |
| `openDialogSelectDir()`             | Dialog     | Folder picker via `dialog.showOpenDialog`                              |
| `selectThemeFile()`                 | Dialog     | File picker for .json themes                                           |
| `importThemeFile(path, dir)`        | Filesystem | Copy theme file to settings dir                                        |
| `listAvailableThemes(dir)`          | Filesystem | Scan themes directory                                                  |
| `loadThemeByName(name, dir)`        | Filesystem | Load theme JSON                                                        |
| `deleteThemeByName(name, dir)`      | Filesystem | Delete user theme file                                                 |
| `listHljsThemes()`                  | Filesystem | List syntax highlighting themes                                        |
| `loadHljsThemeCSS(name)`            | Filesystem | Read hljs CSS file                                                     |
| `listInstalledFonts()`              | Filesystem | Scan fonts directory                                                   |
| `getInstalledFontsStylesheetHref()` | Filesystem | Get file:// URL for fonts.css                                          |
| `refreshInstalledFontsCache()`      | Filesystem | Regenerate fonts.css                                                   |
| `openPath(path)`                    | Shell      | Open directory in Finder                                               |
| `setNativeTheme(mode)`              | Native     | Set light/dark/system, returns shouldUseDarkColors                     |

### Main process native APIs

| API                                           | Usage                                                                                          |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `BrowserWindow`                               | Single window, hidden titlebar, traffic light positioning                                      |
| `app` lifecycle                               | ready, window-all-closed, activate, web-contents-created                                       |
| `protocol.registerFileProtocol("chronicles")` | Serves attachments and fonts from notesDir/settingsDir                                         |
| `dialog.showOpenDialog`                       | Folder and file pickers (2 handlers)                                                           |
| `nativeTheme`                                 | Dark mode detection and switching                                                              |
| `shell.openPath` / `shell.openExternal`       | Open dirs in Finder, URLs in browser                                                           |
| `ipcMain`                                     | 5 handlers (select-directory, select-theme-file, set-native-theme, open-path, inspect-element) |
| CSP headers                                   | Content security policy for dev/prod                                                           |

### Native modules

| Module                  | Replacement                     | Risk                                                      |
| ----------------------- | ------------------------------- | --------------------------------------------------------- |
| `better-sqlite3`        | `bun:sqlite`                    | Low — API is similar, knex compat is the question         |
| `sharp`                 | TBD (see Phase 3 notes)         | Medium — but media is already "fubar", can stub initially |
| `electron-store`        | Simple JSON read/write (fs)     | Low — tiny API surface (get/set/delete/path)              |
| `electron-context-menu` | Electrobun equivalent or custom | Low                                                       |

---

## Migration Phases

### Phase -1: IClient on Bun (Current Milestone)

**Goal:** IClient runs under Bun with no Electron dependencies, validated by unit tests. No Electrobun required — this is pure Bun + IClient work, and also lays the foundation for the CLI.

**Library changes (all in `src/preload/client/` + `src/electron/settings.ts`):**

| Library          | File(s)                                     | What it does                                        | Action                                                                                                   |
| ---------------- | ------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `better-sqlite3` | `factory.ts`, `migrations/index.ts`         | DB driver                                           | → `bun:sqlite`                                                                                           |
| `knex`           | `factory.ts`                                | Query builder                                       | → keep if compat, else raw SQL                                                                           |
| `electron-store` | `files.ts`, `preferences.ts`, `settings.ts` | Typed JSON settings file                            | → custom JSON r/w (own it, zero new deps — API surface is tiny)                                          |
| `sharp`          | `files.ts` (2 call sites)                   | EXIF auto-rotate, resize to 1600px, convert to webp | → remove. Already has a fallback: if sharp throws, writes original bytes. Just always take the fallback. |

`electron-context-menu`, `@electron/packager`, `electron` itself — main-process only, not touched until Phase 5+.

Everything else (`uuidv7`, `uuid25`, `luxon`, `lodash`, `ajv`, `mkdirp`) is Bun-compatible as-is.

**Steps:**

1. Swap `better-sqlite3` → `bun:sqlite` in `factory.ts` and `migrations/index.ts`
2. Test knex compat — if it works, done; if not, replace with raw SQL
3. Replace `electron-store` with a small JSON settings wrapper (`settings-store.ts`)
4. Remove `sharp` from `files.ts` — delete the sharp path, keep the fallback write
5. Write `bun test` unit tests: migrations, journals, documents, tags, FTS5 search

**Deliverable:** `bun test` passes; `bun run src/cli/smoke.ts` calls `createClient()` and lists journals

**Validation:** Tests are the validation. No window, no webview, no Electrobun.

**Resolves open question:** Knex + bun:sqlite compatibility (the highest-risk unknown).

---

### Phase 0: Scaffold & Hello World

**Goal:** Electrobun project boots and shows a webview with static content.

**Steps:**

1. Install Electrobun, create project structure alongside existing Electron code
2. Create Electrobun entry point (`src/electrobun/main.ts` or whatever the convention is)
3. Create a BrowserView that loads a static HTML page
4. Verify build and launch works

**Deliverable:** `bun run dev:electrobun` opens a window with "Hello Chronicles"

**Validation:** Window appears, no crashes. Screenshot it.

**Docs needed:** Getting Started, Project Structure

---

### Phase 1: Load the Renderer

**Goal:** The Vite-built UI renders in the Electrobun webview.

**Steps:**

1. Point the webview at Vite dev server (`http://localhost:5173`) during development
2. For production, load the built `dist/renderer/index.html`
3. Handle any CSP or webview security configuration
4. The app will show the UI but be non-functional (no backend wired up)

**Deliverable:** The full Chronicles UI renders in the Electrobun webview

**Validation:**

- UI loads without console errors (check webview devtools)
- Styles render correctly (Tailwind, themes)
- Navigation works (client-side routing)
- Will show errors for `window.chronicles` calls — that's expected

**Docs needed:** BrowserView API, webview configuration

---

### Phases 2 & 3: ~~Database Layer~~ / ~~Backend Services~~

Absorbed into Phase -1. See above.

---

### Phase 4: IPC/RPC Bridge

**Goal:** The renderer communicates with the Bun backend via Electrobun's typed RPC.

This is the largest phase — every `window.chronicles.*` call needs a new bridge.

**Steps:**

1. Study Electrobun's RPC system (typed handlers, how data flows between main and webview)
2. Define RPC handlers for each of the 14 `window.chronicles` methods
3. Create a renderer-side shim that exposes the same `window.chronicles` interface but calls Electrobun RPC instead of Electron IPC
4. Wire up the RPC handlers in the main process to call the IClient methods
5. Handle the `chronicles://` protocol replacement:
   - Electrobun may have its own protocol/URL scheme for loading local files
   - Or we intercept requests in the RPC layer and serve file contents
   - This affects `<img>` and `<video>` tags that reference attachments

**Approach for minimal renderer changes:**
The renderer currently calls `window.chronicles.foo()`. If we expose the same shape via Electrobun's RPC, the renderer code changes are minimal — ideally just the initialization path.

**Deliverable:** The app is functional — can browse journals, view documents, search

**Validation:**

- Open the app, navigate to a journal, open a document — content displays
- Search works (type a query, results appear)
- Theme switching works
- Font loading works
- Image attachments display (via whatever protocol replacement we use)
- No console errors related to IPC/RPC failures

**Docs needed:** Electrobun RPC API (this is the critical doc)

---

### Phase 5: Native Chrome

**Goal:** Menus, dialogs, window management match the Electron version.

**Steps:**

1. Window configuration: hidden titlebar, traffic light positioning (macOS)
2. File/folder dialogs: `openDialogSelectDir`, `selectThemeFile`
3. Application menu (if Electrobun supports native menus)
4. External link handling: open URLs in default browser
5. `openPath`: open directories in Finder
6. Dark mode detection: `setNativeTheme` equivalent
7. Context menus (replace `electron-context-menu`)
8. Window lifecycle: close/reopen behavior, macOS dock click

**Deliverable:** Full native feel — menus, dialogs, window behavior match Electron version

**Validation:**

- Can select a notes directory via folder picker
- Can import a theme file via file picker
- Dark/light mode switches correctly
- External links open in browser
- Cmd+Q quits, dock click reopens (macOS)
- Context menu works in editor

**Docs needed:** Electrobun Dialogs, Menus, native APIs

---

### Phase 6: Build, Package & Distribution

**Goal:** Distributable macOS app bundle.

**Steps:**

1. Configure Electrobun's build pipeline
2. Replace `@electron/packager` with Electrobun's packaging
3. Handle production asset bundling (renderer, hljs themes, migrations)
4. Code signing and notarization (if Electrobun supports it)
5. Update the `local-install` and `release` skills
6. DMG creation

**Deliverable:** A `.app` bundle that runs on macOS without dev tools installed

**Validation:**

- `bun run build` produces a working app
- App launches from /Applications
- All features work in production build (not just dev mode)
- Bundle size is in the expected range (~12-15MB)

**Docs needed:** Electrobun Build & Distribute

---

## LLM Agent Strategy

### Context each agent needs per phase

| Phase        | Essential context files                                                                                              |
| ------------ | -------------------------------------------------------------------------------------------------------------------- |
| -1 (IClient) | `src/preload/client/` (all files), `src/electron/migrations/index.ts`, `src/electron/settings.ts`, `bun:sqlite` docs |
| 0 (Scaffold) | Electrobun getting started docs, project structure docs                                                              |
| 1 (Renderer) | `vite.config.ts`, `src/index.html`, Electrobun BrowserView docs                                                      |
| 2 (Database) | Already done in Phase -1                                                                                             |
| 3 (Backend)  | Already done in Phase -1                                                                                             |
| 4 (IPC/RPC)  | `src/preload/index.ts`, Electrobun RPC docs, `src/views/StyleWatcher.tsx`, `src/hooks/useClient.ts`                  |
| 5 (Native)   | `src/electron/index.ts`, Electrobun native API docs                                                                  |
| 6 (Build)    | `scripts/build.sh`, `scripts/build-main-preload.js`, Electrobun build docs                                           |

### Validation feedback loops

Each phase should have a runnable check the agent can execute:

- **Phase -1:** `bun test` unit tests against IClient directly; no Electrobun needed
- **Phase 0-1:** `bun run dev:electrobun` → screenshot/accessibility check
- **Phase 4:** Launch app, run through a manual checklist (or simple automation)
- **Phase 5-6:** Manual QA against a checklist

### Parallel work opportunities

- Phase -1 (IClient on Bun) and Phase 0-1 (scaffold + renderer) can be done in parallel by different agents
- Phase 4 (IPC/RPC) depends on Phase -1 + Phase 1
- Phase 5 (native) depends on Phase 4
- Phase 6 (build) depends on Phase 5

---

## Decisions Made

1. **Sharp:** Remove it. The existing fallback (write original bytes) stays. No resize, no webp conversion. Re-add proper image processing later as a standalone improvement.
2. **Coexistence:** Cut over immediately. Replace Electron entry points with Electrobun, no parallel maintenance.
3. **Bundler:** Keep Vite for the renderer. Proven, working, has Vitest. One migration at a time.

## Open Questions

1. **Knex + bun:sqlite:** Does knex work with bun:sqlite? Determines whether Phase -1 is "swap a config line" or "rewrite queries." Will be resolved during Phase -1.

2. **`chronicles://` protocol:** ~~How does Electrobun handle custom URL schemes / local file serving in webviews?~~ **Resolved:** There is no `registerFileProtocol` equivalent. `urlSchemes` in `electrobun.config.ts` is deep-link only (external app-launch URLs). The solution is RPC + data URLs: images are fetched via RPC and displayed as `data:` URLs (Lexical controls rendering); fonts are fetched via RPC at startup and injected as `<style>` blocks with base64 `@font-face` data. See `docs/vendor/electrobun/browser-view-window.md` for details.

---

## Risk Assessment

| Risk                                           | Likelihood | Impact | Mitigation                                                                |
| ---------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------- |
| Knex doesn't work with bun:sqlite              | Medium     | Medium | Write thin adapter or drop knex (small query surface)                     |
| Electrobun webview quirks (WebKit vs Chromium) | Medium     | High   | Test early in Phase 1; CSS/JS differences may need fixes                  |
| Electrobun missing APIs we need                | Low-Medium | High   | Check docs thoroughly before starting; fallback to Swift if critical gaps |
| Bun Node.js compat gaps                        | Low        | Medium | Most code is standard Node.js (fs, path, crypto); validated in Phase -1   |
| Electrobun is immature (v1.0, tiny ecosystem)  | Known      | High   | This is the accepted bet; Swift is the fallback                           |

---

## Files to Modify/Create

### New files

```
# Phase -1
src/electron/settings-store.ts    # JSON-based settings (replaces electron-store; neutral location, used by both CLI and desktop)
src/preload/client/sqlite-bun.ts  # bun:sqlite adapter (only if knex needs it)

# Phase 0+
src/electrobun/
  main.ts                         # Electrobun app bootstrap
  rpc-handlers.ts                 # RPC handler definitions
```

### Modified files

```
# Phase -1
src/preload/client/factory.ts     # Swap DB driver (better-sqlite3 → bun:sqlite)
src/preload/client/files.ts       # Remove sharp, keep fallback write
src/preload/client/preferences.ts # Use new settings store
src/electron/settings.ts          # Use new settings store
src/electron/migrations/index.ts  # Port to bun:sqlite

# Phase 0+
vite.config.ts                    # May need adjustments for Electrobun dev
package.json                      # New deps, new scripts
```

### Unchanged (the whole point)

```
src/views/          # All React components
src/components/     # All UI components
src/hooks/          # All stores and hooks
src/markdown/       # All markdown processing
src/themes/         # Theme system (pure TS)
src/fonts/          # Font system (pure TS, uses fs)
```
