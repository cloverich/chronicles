# Electron Reference

How Chronicles ran on Electron. Keep this around in case we need to roll back from Electrobun.

---

## Architecture

Electron runs two Node.js processes sharing a Chromium webview:

```
Main process (src/electron/index.ts)
  ├── BrowserWindow — creates the app window
  ├── protocol.registerFileProtocol("chronicles") — serves local files
  ├── ipcMain handlers — directory/file dialogs, native theme, shell open
  ├── app lifecycle — ready, window-all-closed, activate
  └── CSP headers — content security policy per environment

Preload (src/preload/index.ts)
  ├── contextBridge.exposeInMainWorld("chronicles", {...})
  ├── getClient() → IClient backed by knex + better-sqlite3
  └── 13 utility methods (dialogs, themes, fonts, shell)
```

The renderer (React) calls `window.chronicles.*` which the preload script exposes. The preload runs in a privileged context with access to Node.js APIs and Electron IPC, but the renderer itself has `nodeIntegration: false` and `contextIsolation: true`.

---

## chronicles:// Protocol Handler

The centerpiece of local file serving. Markdown stores relative paths like `../_attachments/image.png`. At render time, `src/hooks/images.tsx` prepends `chronicles://` to make `chronicles://../_attachments/image.png`. Electron intercepts this via a custom protocol handler.

### How it worked

```typescript
// src/electron/index.ts
protocol.registerFileProtocol("chronicles", (request, callback) => {
  const path = validateChroniclesUrl(request.url);
  callback({ path: path ?? undefined });
});
```

### URL routing

| URL prefix                                  | Resolves to                           |
| ------------------------------------------- | ------------------------------------- |
| `chronicles://../_attachments/foo.png`      | `{notesDir}/_attachments/foo.png`     |
| `chronicles://../_settings/fonts/bar.woff2` | `{settingsDir}/fonts/bar.woff2`       |
| Anything else                               | Blocked (logged warning, returns 404) |

### Security

- **Directory traversal protection:** Resolved path is checked against the base directory via `path.relative()` — rejects any path that escapes with `..`
- **Existence check:** Returns 404 if file doesn't exist on disk
- **Allowlist:** Only `_attachments` and `_settings/fonts` prefixes are accepted

### CSP integration

The Content Security Policy explicitly allows `chronicles://*` in `img-src`, `media-src`, `font-src`, and `connect-src` directives. In dev mode, the Vite dev server origin is also added.

### Known limitation

`registerFileProtocol` was deprecated in favor of `protocol.handle()`, but the newer API broke video seeking. The deprecated API was kept for video compatibility (which was already marginal).

---

## Preload Bridge (the RPC layer)

Electron's `contextBridge.exposeInMainWorld` creates a serialization-safe bridge between the preload context (has Node.js) and the renderer (pure browser).

### window.chronicles API

| Method                              | Category   | Implementation                                                     |
| ----------------------------------- | ---------- | ------------------------------------------------------------------ |
| `getClient()`                       | Core       | Returns IClient singleton (knex + better-sqlite3 + electron-store) |
| `openDialogSelectDir()`             | Dialog     | IPC to main → `dialog.showOpenDialog`                              |
| `selectThemeFile()`                 | Dialog     | IPC to main → `dialog.showOpenDialog` with JSON filter             |
| `importThemeFile(path, dir)`        | Filesystem | `fs.copyFileSync` in preload                                       |
| `listAvailableThemes(dir)`          | Filesystem | `fs.readdirSync` in preload                                        |
| `loadThemeByName(name, dir)`        | Filesystem | `fs.readFileSync` + JSON.parse in preload                          |
| `deleteThemeByName(name, dir)`      | Filesystem | `fs.unlinkSync` in preload                                         |
| `listHljsThemes()`                  | Filesystem | Read from bundled hljs-themes dir                                  |
| `loadHljsThemeCSS(name)`            | Filesystem | Read CSS file contents                                             |
| `listInstalledFonts()`              | Filesystem | Scan fonts directory                                               |
| `getInstalledFontsStylesheetHref()` | Filesystem | Return `file://` URL for fonts.css                                 |
| `refreshInstalledFontsCache()`      | Filesystem | Regenerate fonts.css from font dir                                 |
| `openPath(path)`                    | Shell      | IPC to main → `shell.openPath`                                     |
| `setNativeTheme(mode)`              | Native     | IPC to main → `nativeTheme.themeSource = mode`                     |

### Key detail: IClient ran in-process

In Electron, `getClient()` returned a client backed by `knex` + `better-sqlite3` running **directly in the preload process** (same V8 isolate as the renderer, but with Node.js access). No serialization, no IPC — just direct function calls. This made the `IClient` interface synchronous-feeling even though methods return Promises.

In Electrobun, this becomes true RPC: the renderer calls through Electrobun's typed RPC to the Bun main process, which runs `BunClient` (drizzle + bun:sqlite). The `window.chronicles` shape stays identical — only the transport changes.

---

## Main Process Behaviors

### Window configuration

```typescript
new BrowserWindow({
  backgroundColor: "#121212",
  show: false, // hide until ready-to-show to avoid white flash
  width: 800,
  height: 800,
  titleBarStyle: "hidden",
  trafficLightPosition: { x: 10, y: 16 },
  webPreferences: {
    nodeIntegration: false,
    sandbox: false,
    contextIsolation: true,
    preload: "preload.bundle.mjs",
  },
});
```

### Link handling

All navigation from the renderer is intercepted:

- `chronicles://` links → validate, then `shell.showItemInFolder`
- `http://` / `https://` / `mailto:` → `shell.openExternal`
- Everything else → blocked

New window creation is denied (`setWindowOpenHandler` returns `{ action: "deny" }`).

### Context menu

`electron-context-menu` package provided right-click menu with Cut/Copy/Paste, spell checking suggestions, "Look Up", and "Search with Google".

### Native dependencies

| Package          | Why                                               | Electrobun replacement  |
| ---------------- | ------------------------------------------------- | ----------------------- |
| `better-sqlite3` | SQLite driver (C++ addon, needs electron-rebuild) | `bun:sqlite` (built-in) |
| `sharp`          | Image resize/convert on upload                    | Dropped (passthrough)   |
| `electron-store` | Persistent key-value settings                     | JSON file read/write    |
| `knex`           | SQL query builder for better-sqlite3              | Drizzle ORM             |

---

## Build & Package Pipeline

```
build.sh:
  1. esbuild bundles main + preload → src/main.bundle.mjs, src/preload.bundle.mjs
  2. vite build → dist/renderer/
  3. Copy bundles + package.json + yarn.lock into dist/
  4. yarn install in dist/ (installs runtime deps for packaged app)
  5. electron-packager bundles into .app with embedded Chromium + Node
```

The packaged app is ~100MB+, mostly Chromium.

---

## Rolling Back

If we need to return to Electron:

1. Restore `src/electron/index.ts` and `src/preload/` from git history
2. Re-add Electron deps: `electron`, `@electron/packager`, `@electron/rebuild`, `better-sqlite3`, `knex`, `electron-store`, `electron-context-menu`, `sharp`
3. Re-add `postinstall: "electron-rebuild"` script
4. Restore `build.sh` Electron packaging steps
5. Restore `scripts/dev.mjs` Electron process spawning
6. The renderer (`src/views/`) needs zero changes — `window.chronicles` is the same shape
7. `src/bun-client/` can stay — it's independent. But the Electron preload would use the old knex client.

The hard part of rolling back is native module rebuild configuration, not code. The architecture was designed so the renderer doesn't know or care which shell it runs in.
