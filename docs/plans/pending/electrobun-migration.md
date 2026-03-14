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

### Phase 2: Database Layer

**Goal:** `bun:sqlite` replaces `better-sqlite3`, all queries work.

**Steps:**

1. Create a `bun:sqlite`-compatible adapter or wrapper
2. Assess knex compatibility with `bun:sqlite`:
   - If knex works: swap the driver config
   - If knex doesn't work: replace knex queries with raw SQL (there aren't that many — journals, documents, tags, indexer, importer, bulk ops)
3. Port the 3 migrations to work with `bun:sqlite`
4. Verify FTS5 works with `bun:sqlite` (it should — it's a SQLite extension)

**Deliverable:** All database operations work on `bun:sqlite`

**Validation:**

- Migrations run successfully on a fresh database
- Can insert and query journals, documents, tags
- FTS5 search returns correct results
- Existing test fixtures (if any) pass
- Performance sanity check: index a real notesDir, verify query times

**Docs needed:** `bun:sqlite` API reference

**Key risk:** Knex compatibility. If knex's `better-sqlite3` dialect doesn't work with `bun:sqlite`, we have two options:

- Write a thin adapter that makes `bun:sqlite` look like `better-sqlite3` to knex
- Drop knex and use raw SQL (the query surface is small enough)

---

### Phase 3: Backend Services on Bun

**Goal:** All IClient services work in Bun runtime (no Electron dependencies).

**Steps:**

1. Replace `electron-store` with a simple JSON settings store:
   - Same interface: `get(key)`, `set(key, value)`, `delete(key)`, `path`
   - Read/write a JSON file in the settings directory
   - This was already planned for the CLI extraction (Phase 0 of CLI plan)
2. Handle `sharp`:
   - **Option A (recommended initially):** Stub it — save uploaded images as-is (no resize/webp conversion). This unblocks the migration. Media handling is already problematic.
   - **Option B:** Use `sharp` on Bun if it works (it may — sharp has prebuilt binaries)
   - **Option C:** Replace with a Bun-native image library if one exists
   - **Option D:** Shell out to system tools (`sips` on macOS) for basic resize/convert
3. Port `FilesClient` — pure `fs` operations, should work on Bun as-is
4. Port `PreferencesClient` — remove `document.dispatchEvent` calls (browser-only), use the new settings store
5. Verify all other clients work (journals, documents, tags, indexer, importer, bulkOperations)

**Deliverable:** `createClient()` works in Bun with no Electron dependencies

**Validation:**

- Write a smoke script: `bun run src/cli/smoke.ts` that calls `createClient()` and lists journals
- All client methods callable and returning data
- Image upload works (even if just saving raw bytes without processing)

**Docs needed:** Bun Node.js compatibility (for `fs`, `path`, `crypto`, `Buffer`, `stream` usage)

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

| Phase        | Essential context files                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| 0 (Scaffold) | Electrobun getting started docs, project structure docs                                                            |
| 1 (Renderer) | `vite.config.ts`, `src/index.html`, Electrobun BrowserView docs                                                    |
| 2 (Database) | `src/electron/migrations/index.ts`, `src/preload/client/factory.ts`, representative query files, `bun:sqlite` docs |
| 3 (Backend)  | `src/preload/client/` (all files), `src/electron/settings.ts`, `src/preload/client/files.ts`                       |
| 4 (IPC/RPC)  | `src/preload/index.ts`, Electrobun RPC docs, `src/views/StyleWatcher.tsx`, `src/hooks/useClient.ts`                |
| 5 (Native)   | `src/electron/index.ts`, Electrobun native API docs                                                                |
| 6 (Build)    | `scripts/build.sh`, `scripts/build-main-preload.js`, Electrobun build docs                                         |

### Validation feedback loops

Each phase should have a runnable check the agent can execute:

- **Phase 0-1:** `bun run dev:electrobun` → screenshot/accessibility check
- **Phase 2:** Smoke script that queries the database
- **Phase 3:** Smoke script that exercises all IClient methods
- **Phase 4:** Launch app, run through a manual checklist (or simple automation)
- **Phase 5-6:** Manual QA against a checklist

### Parallel work opportunities

- Phase 2 (database) and Phase 0-1 (scaffold + renderer) can be done in parallel by different agents
- Phase 3 (backend services) depends on Phase 2
- Phase 4 (IPC) depends on Phases 1 + 3
- Phase 5 (native) depends on Phase 4
- Phase 6 (build) depends on Phase 5

---

## Decisions Made

1. **Sharp:** Stub it. Save uploaded images as-is (no resize/webp conversion). Unblocks migration, fix media handling later.
2. **Coexistence:** Cut over immediately. Replace Electron entry points with Electrobun, no parallel maintenance.
3. **Bundler:** Keep Vite for the renderer. Proven, working, has Vitest. One migration at a time.

## Open Questions

1. **Knex + bun:sqlite:** Does knex work with bun:sqlite? This determines whether Phase 2 is "swap a config line" or "rewrite all queries." Need to test early.

2. **`chronicles://` protocol:** ~~How does Electrobun handle custom URL schemes / local file serving in webviews?~~ **Resolved:** There is no `registerFileProtocol` equivalent. `urlSchemes` in `electrobun.config.ts` is deep-link only (external app-launch URLs). The solution is RPC + data URLs: images are fetched via RPC and displayed as `data:` URLs (Lexical controls rendering); fonts are fetched via RPC at startup and injected as `<style>` blocks with base64 `@font-face` data. See `docs/vendor/electrobun/browser-view-window.md` for details.

---

## Risk Assessment

| Risk                                           | Likelihood | Impact | Mitigation                                                                |
| ---------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------- |
| Knex doesn't work with bun:sqlite              | Medium     | Medium | Write thin adapter or drop knex (small query surface)                     |
| Electrobun webview quirks (WebKit vs Chromium) | Medium     | High   | Test early in Phase 1; CSS/JS differences may need fixes                  |
| Electrobun missing APIs we need                | Low-Medium | High   | Check docs thoroughly before starting; fallback to Swift if critical gaps |
| sharp doesn't work on Bun                      | High       | Low    | Stub it; media handling is already problematic                            |
| Bun Node.js compat gaps                        | Low        | Medium | Most code is standard Node.js (fs, path, crypto); test in Phase 3         |
| Electrobun is immature (v1.0, tiny ecosystem)  | Known      | High   | This is the accepted bet; Swift is the fallback                           |

---

## Files to Modify/Create

### New files

```
src/electrobun/           # New main process entry
  main.ts                 # Electrobun app bootstrap
  rpc-handlers.ts         # RPC handler definitions
  settings-store.ts       # JSON-based settings (replaces electron-store)

src/preload/client/
  sqlite-bun.ts           # bun:sqlite adapter (if knex needs it)

docs/vendor/
  electrobun/             # Fetched documentation
  bun/                    # bun:sqlite docs
```

### Modified files

```
src/preload/client/factory.ts     # Swap DB driver
src/preload/client/preferences.ts # Use new settings store
src/preload/client/files.ts       # Handle sharp replacement
src/electron/migrations/index.ts  # Port to bun:sqlite
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
