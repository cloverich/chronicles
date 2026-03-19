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

### Portable backend

Phase 1 (bun-client) proved `BunClient` runs fully independent of Electron. This opens doors beyond Electrobun — the same backend could serve a web app over HTTP, power a CLI tool, or wire into any desktop shell. Electrobun is the current target, but the architecture doesn't lock us in.

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

### Phase 1: IClient on Bun ✅ COMPLETE

**Status:** Complete — 106/106 tests passing across 10 test files.

**Full plan:** [docs/plans/active/bun-client.md](../../plans/active/bun-client.md)

All modules ported to Drizzle ORM + bun:sqlite: journals, documents, tags, preferences, files, indexer, bulk operations, importer. Settings store replaces electron-store. Sharp dropped (passthrough fallback). Smoke test validates end-to-end.

---

### Phase 2: Scaffold & Hello World ✅ COMPLETE

**Status:** Complete. `electrobun.config.ts` created, `src/electrobun/main.ts` entry point with BrowserWindow (hiddenInset titlebar, 900×800), ApplicationMenu with Edit/View. Dev mode loads `http://localhost:5173`.

---

### Phase 3: Load the Renderer ✅ COMPLETE

**Status:** Complete. Electrobun webview loads the Vite dev server. `src/electrobun/views/main/` scaffolded with Electroview initialization. Production mode configured for `views://main/index.html`.

---

### Phase 4: IPC/RPC Bridge ✅ COMPLETE

**Status:** Complete.

**Architecture:** Generic dispatch pattern for IClient + individual typed handlers for 13 utility methods.

**Files created:**
- `src/electrobun/rpc-schema.ts` — `ChroniclesRPC` type with `clientCall` (generic dispatch) + 13 typed request handlers + `showContextMenu` message
- `src/electrobun/rpc-handlers.ts` — Bun-side handler factory; `clientCall` dispatches dynamically to BunClient sub-modules via `c[module][method].apply(mod, args)`
- `src/electrobun/chronicles-shim.ts` — Webview-side `installChroniclesShim(rpc)` that creates Proxy-based IClient (all ~50+ methods auto-routed through RPC)

**Key design decision:** Rather than creating individual RPC handlers for every IClient method (~50+), a single `clientCall` handler accepts `{ module, method, args }` and dispatches dynamically. The webview-side `getClient()` returns a two-level Proxy that converts `client.journals.list()` → `rpc.request.clientCall({ module: "journals", method: "list", args: [] })`. This means no schema changes when IClient methods change.

**Known gap:** `chronicles://` protocol for images/fonts needs data URL replacement (deferred to QA phase).

---

### Phase 5: Native Chrome ✅ COMPLETE

**Status:** Complete.

**What's wired:**
- ✅ Hidden titlebar with inset traffic lights (`titleBarStyle: "hiddenInset"`)
- ✅ ApplicationMenu (Chronicles, Edit with standard roles, View with reload/devtools)
- ✅ File/folder dialogs via `Utils.openFileDialog`
- ✅ `openPath` via `Utils.openPath`
- ✅ Context menu via `ContextMenu.showContextMenu` (triggered by webview→bun RPC message)
- ✅ External link interception (`will-navigate` event → `Utils.openExternal`)
- ✅ macOS window lifecycle (`exitOnLastWindowClosed: false`)

**Known gaps:**
- `setNativeTheme` returns `false` (Electrobun v1 has no native theme API; renderer uses `prefers-color-scheme` CSS media query instead)
- Spell checking not yet configured (was `electron-context-menu` feature)

---

### Phase 6: Build, Package & QA

**Goal:** Validate the Electrobun app works end-to-end, then cut over.

**Steps:**

1. **QA in dev mode:** Launch `electrobun dev` + Vite, test all features against checklist
2. **Fix `chronicles://` protocol:** Replace with RPC + data URLs for images and base64 fonts
3. **Configure Electrobun build:** `electrobun build --env=stable`, bundled assets, Drizzle migrations
4. **Code signing:** `build.mac.codesign: true` in `electrobun.config.ts`
5. **Test production build:** App launches from built bundle, all features work
6. **Cut over:** Delete `src/electron/`, `src/preload/`, remove Electron deps, update scripts
7. **Update skills:** `local-install` and `release` skills point at Electrobun build

**Deliverable:** A working `.app` bundle; Electron code deleted.

**Validation checklist:**
- [ ] Open app, navigate to journal, view document
- [ ] Create/edit/delete documents
- [ ] Search works (FTS)
- [ ] Theme switching (light/dark/custom)
- [ ] Font loading (custom fonts display)
- [ ] Image attachments display
- [ ] Import from Notion
- [ ] File/folder dialogs work
- [ ] Context menu works
- [ ] External links open in browser
- [ ] Cmd+Q quits, dock click reopens
- [ ] Bundle size ≤ 15MB
- [ ] Startup time < 100ms

**Docs needed:** Electrobun Build & Distribute

---

## LLM Agent Strategy

### Context each agent needs per phase

| Phase        | Essential context files                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1 (IClient)  | `docs/plans/active/bun-client.md`, `src/preload/client/` (all files), `src/electron/migrations/index.ts`, `src/electron/settings.ts` |
| 2 (Scaffold) | Electrobun getting started docs, project structure docs                                                                              |
| 3 (Renderer) | `vite.config.ts`, `src/index.html`, Electrobun BrowserView docs                                                                      |
| 4 (IPC/RPC)  | `src/preload/index.ts`, Electrobun RPC docs, `src/views/StyleWatcher.tsx`, `src/hooks/useClient.ts`                                  |
| 5 (Native)   | `src/electron/index.ts`, Electrobun native API docs                                                                                  |
| 6 (Build)    | `scripts/build.sh`, `scripts/build-main-preload.js`, Electrobun build docs                                                           |

### Validation feedback loops

Each phase should have a runnable check the agent can execute:

- **Phase 1:** `bun test src/bun-client/` — all green; no Electrobun needed
- **Phase 2-3:** `bun run dev:electrobun` → screenshot/accessibility check
- **Phase 4:** Launch app, run through a manual checklist (or simple automation)
- **Phase 5-6:** Manual QA against a checklist

### Parallel work opportunities

- Phase 1 (IClient on Bun) and Phases 2-3 (scaffold + renderer) can be done in parallel by different agents
- Phase 4 (IPC/RPC) depends on Phase 1 + Phase 3
- Phase 5 (native) depends on Phase 4
- Phase 6 (build) depends on Phase 5

---

## Decisions Made

1. **Sharp:** Remove it. The existing fallback (write original bytes) stays. No resize, no webp conversion. Re-add proper image processing later as a standalone improvement.
2. **~~Coexistence:~~** ~~Cut over immediately.~~ **Revised: Dual-track.** Electron and Electrobun run side-by-side throughout Phases 2-5. The glue code is tiny (~450 lines total across main + preload) — maintaining two shells temporarily is low-cost. This de-risks the migration: Electron stays working while Electrobun matures. Phase 6 (cut over) deletes `src/electron/`, `src/preload/`, and Electron deps. See rationale below.
3. **Bundler:** Keep Vite for the renderer. Proven, working, has Vitest. One migration at a time.

### Dual-track rationale

The hard decoupling is already done:
- **Backend:** `src/bun-client/` is fully independent (106 tests, no Electron deps)
- **Frontend:** Vite-built renderer is pure React/TypeScript, zero Electron APIs
- **Bridge:** All 14 integration points go through `window.chronicles` — a facade that either shell can implement

What actually differs per shell is minimal:
- Electron: `src/electron/index.ts` (~376 lines) + `src/preload/utils.electron.tsx` (~90 lines)
- Electrobun: equivalent entry + RPC handlers mapping to same `window.chronicles` shape

The migration end-state is **deletion, not refactoring** — when Electrobun passes QA, we `rm -rf src/electron/ src/preload/` and strip Electron deps from package.json.

## Open Questions

1. ~~**Knex + bun:sqlite:**~~ **Resolved.** Knex has no bun:sqlite support. We chose Drizzle ORM (`drizzle-orm/bun-sqlite`). Phase 1 is complete with 106/106 tests passing.

2. **`chronicles://` protocol:** ~~How does Electrobun handle custom URL schemes / local file serving in webviews?~~ **Resolved:** There is no `registerFileProtocol` equivalent. `urlSchemes` in `electrobun.config.ts` is deep-link only (external app-launch URLs). The solution is RPC + data URLs: images are fetched via RPC and displayed as `data:` URLs (Lexical controls rendering); fonts are fetched via RPC at startup and injected as `<style>` blocks with base64 `@font-face` data. See `docs/vendor/electrobun/browser-view-window.md` for details.

---

## Risk Assessment

| Risk                                           | Likelihood | Impact | Mitigation                                                                |
| ---------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------- |
| ~~Knex doesn't work with bun:sqlite~~           | Resolved   | —      | Chose Drizzle ORM instead. Phase 1 complete.                              |
| Electrobun webview quirks (WebKit vs Chromium) | Medium     | High   | Test early in Phase 1; CSS/JS differences may need fixes                  |
| Electrobun missing APIs we need                | Low-Medium | High   | Check docs thoroughly before starting; fallback to Swift if critical gaps |
| Bun Node.js compat gaps                        | Low        | Medium | Most code is standard Node.js (fs, path, crypto); validated in Phase -1   |
| Electrobun is immature (v1.0, tiny ecosystem)  | Known      | High   | This is the accepted bet; Swift is the fallback                           |

---

## Files to Modify/Create

### New files

```
# Phase 1 (bun-client — parallel to existing src/preload/client/)
src/bun-client/
  schema.ts           # Drizzle table definitions
  migrations/         # drizzle-kit generated SQL
  factory.ts          # createClient() → IClient
  settings-store.ts   # JSON r/w (replaces electron-store)
  preferences.ts
  journals.ts
  documents.ts
  tags.ts
  indexer.ts
  importer.ts
  bulk-operations.ts
  smoke.ts

# Phase 2+
src/electrobun/
  main.ts             # Electrobun app bootstrap
  rpc-handlers.ts     # RPC handler definitions
```

### Modified files

```
# Phase 1 — untouched (parallel approach; old client stays intact)
# src/preload/client/ — no changes until Phase 4 cutover

# Phase 2+
vite.config.ts   # May need adjustments for Electrobun dev
package.json     # New deps, new scripts
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
