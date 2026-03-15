# Electrobun BrowserWindow & BrowserView APIs

> Source: https://blackboard.sh/electrobun/docs/apis/browser-window/ + source code
> Fetched from: https://github.com/blackboardsh/electrobun/tree/main/package/src/bun/core/
> Version: v1.x (2026)

## Overview

- **`BrowserWindow`** — a native OS window. Creates one `BrowserView` automatically.
- **`BrowserView`** — a webview embedded in a window. The actual rendering surface.

In most apps you'll use `BrowserWindow` directly. `BrowserView` is exposed for advanced use cases (multiple webviews per window, OOPIFs, etc.).

## BrowserWindow

### Constructor Options (`WindowOptionsType`)

```typescript
import { BrowserWindow } from "electrobun/bun";

const win = new BrowserWindow({
  title: "Chronicles", // Window title bar text
  frame: {
    x: 100,
    y: 100, // Initial position
    width: 1200,
    height: 800, // Initial size
  },
  url: "views://main/index.html", // Load URL on startup
  html: null, // OR inline HTML string
  preload: null, // Raw JS string injected before page scripts. No isolated context, no Node access — RPC fills that role.
  renderer: "native", // "native" (system WebView) | "cef" (Chromium)
  rpc: myRPC, // Typed RPC (see rpc.md)
  titleBarStyle: "hiddenInset", // "default" | "hidden" | "hiddenInset"
  transparent: false, // Transparent window background
  hidden: false, // Start hidden
  navigationRules: null, // JSON navigation whitelist
  sandbox: false, // Disable RPC, untrusted content only
});
```

### titleBarStyle Options (macOS)

| Value           | Description                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------- |
| `"default"`     | Normal titlebar with native window controls                                                    |
| `"hidden"`      | No titlebar, no native window controls (fully custom chrome)                                   |
| `"hiddenInset"` | Transparent titlebar with inset native controls (traffic lights visible, content fills window) |

Chronicles currently uses `hiddenInset` equivalent in Electron.

### BrowserWindow Methods

```typescript
// Window management
win.setTitle(title: string)
win.close()
win.focus()
win.show()
win.minimize()
win.unminimize()
win.isMinimized(): boolean
win.maximize()
win.unmaximize()
win.isMaximized(): boolean
win.setFullScreen(fullScreen: boolean)
win.isFullScreen(): boolean
win.setAlwaysOnTop(alwaysOnTop: boolean)
win.setVisibleOnAllWorkspaces(visible: boolean)

// Position & size
win.setPosition(x: number, y: number)
win.setSize(width: number, height: number)
win.setFrame(x: number, y: number, width: number, height: number)
win.getFrame(): { x, y, width, height }
win.getPosition(): { x, y }
win.getSize(): { width, height }

// Zoom (WebKit only)
win.setPageZoom(zoomLevel: number)  // 1.0 = 100%, 1.5 = 150%
win.getPageZoom(): number

// Events
win.on("close", handler)
// ... other window lifecycle events

// Access the underlying BrowserView
win.webview  // → BrowserView instance
```

### Static Methods

```typescript
BrowserWindow.getById(id: number): BrowserWindow | undefined
```

### Accessing the Webview (RPC)

```typescript
// Call webview-side RPC methods from bun
win.webview.rpc.request.someWebviewMethod(params);
win.webview.rpc.send.someWebviewMessage(payload);
```

---

## BrowserView

`BrowserView` is the webview surface. `BrowserWindow` creates one automatically, but you can create additional ones.

### Constructor Options (`BrowserViewOptions`)

```typescript
import { BrowserView } from "electrobun/bun";

const view = new BrowserView({
  url: "views://main/index.html",
  html: null, // OR inline HTML
  preload: null,
  renderer: "native", // "native" | "cef"
  partition: null, // Session partition name for cookie/storage isolation
  frame: { x: 0, y: 0, width: 1200, height: 800 },
  rpc: myRPC,
  hostWebviewId: undefined, // Parent webview ID (for OOPIFs)
  autoResize: true, // Auto-resize with window
  windowId: win.id, // Window to attach to
  navigationRules: null,
  sandbox: false,
  startTransparent: false,
  startPassthrough: false,
});
```

### BrowserView Methods

```typescript
// Navigation
view.loadURL(url: string)
view.loadHTML(html: string)

// Navigation rules
view.setNavigationRules(rules: string[])

// Find in page
view.findInPage(searchText: string, options?: { forward?: boolean; matchCase?: boolean })
view.stopFindInPage()

// DevTools
view.openDevTools()
view.closeDevTools()
view.toggleDevTools()

// Zoom
view.setPageZoom(zoomLevel: number)
view.getPageZoom(): number

// Lifecycle
view.remove()

// Events
view.on("will-navigate", handler)
view.on("did-navigate", handler)
view.on("did-navigate-in-page", handler)
view.on("did-commit-navigation", handler)
view.on("dom-ready", handler)
view.on("download-started", handler)
view.on("download-progress", handler)
view.on("download-completed", handler)
view.on("download-failed", handler)
```

### Static Methods

```typescript
BrowserView.getById(id: number): BrowserView | undefined
BrowserView.getAll(): BrowserView[]
BrowserView.defineRPC<Schema>(config): RPC   // Define bun-side RPC handlers
```

---

## URL Schemes

| Scheme                  | Use                                 | Example                   |
| ----------------------- | ----------------------------------- | ------------------------- |
| `views://`              | Serve bundled views from app bundle | `views://main/index.html` |
| `http://localhost:PORT` | Dev server (Vite etc.)              | `http://localhost:5173`   |

**Note on `chronicles://` protocol:** There is **no `registerFileProtocol` equivalent in Electrobun**. The `urlSchemes` config option is for deep linking only (opening the app from an external `myapp://` URL) — it does not intercept resource loads from within the webview.

For serving arbitrary files from the user's filesystem (attachments, fonts), the approach is RPC-based:

1. **Images** — The renderer calls an RPC method, receives the file as base64, and sets the `src` as a `data:` URL. Works naturally since Lexical/React controls image rendering.
2. **Fonts** — On startup, call an RPC method to fetch each font file as base64, then inject a `<style>` block with `@font-face` rules using `data:` URLs. This replaces the current `getInstalledFontsStylesheetHref()` → `<link>` approach.

This replaces Electron's `protocol.registerFileProtocol("chronicles", ...)`.

---

## Electron → Electrobun Migration Reference

| Electron                                              | Electrobun                                                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `new BrowserWindow({ titleBarStyle: "hiddenInset" })` | `new BrowserWindow({ titleBarStyle: "hiddenInset" })` — same!                                                      |
| `win.loadURL(url)`                                    | `win.webview.loadURL(url)`                                                                                         |
| `win.webContents.openDevTools()`                      | `win.webview.openDevTools()`                                                                                       |
| `win.on("close", ...)`                                | `win.on("close", ...)` — same!                                                                                     |
| `protocol.registerFileProtocol("chronicles", ...)`    | RPC + data URLs (no protocol handler equivalent)                                                                   |
| `contextBridge.exposeInMainWorld(...)`                | Replaced entirely by typed RPC                                                                                     |
| `ipcMain.handle(...)`                                 | Replaced by `BrowserView.defineRPC` handlers                                                                       |
| `ipcRenderer.invoke(...)`                             | Replaced by `view.rpc.request.*()`                                                                                 |
| Electron preload (Node context, `contextBridge`)      | No equivalent — RPC fills this role. Electrobun `preload` is plain JS injected into the page, no process boundary. |
