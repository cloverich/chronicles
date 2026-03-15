# Electrobun Native APIs

> Source: https://blackboard.sh/electrobun/docs/apis/ + source code
> Fetched from: https://github.com/blackboardsh/electrobun/tree/main/package/src/bun/core/
> Version: v1.x (2026)

Covers: Dialogs, Shell, ApplicationMenu, ContextMenu, Paths, Dark Mode / Theme

---

## File & Folder Dialogs (`Utils`)

```typescript
import { Utils } from "electrobun/bun";

// Open file/folder picker
const paths = await Utils.openFileDialog({
  startingFolder: "~/", // initial directory
  allowedFileTypes: "*", // e.g. "json,txt" or "*"
  canChooseFiles: true,
  canChooseDirectory: true,
  allowsMultipleSelection: true,
});
// Returns: string[] of selected paths

// Single folder picker (Electron equivalent: dialog.showOpenDialog)
const [folderPath] = await Utils.openFileDialog({
  canChooseFiles: false,
  canChooseDirectory: true,
  allowsMultipleSelection: false,
});

// Single file picker (for theme JSON)
const [filePath] = await Utils.openFileDialog({
  canChooseFiles: true,
  canChooseDirectory: false,
  allowsMultipleSelection: false,
  allowedFileTypes: "json",
});
```

### Message Box Dialog

```typescript
const { response } = await Utils.showMessageBox({
  type: "question", // "info" | "warning" | "error" | "question"
  title: "Confirm Delete",
  message: "Delete this journal?",
  detail: "This action cannot be undone.",
  buttons: ["Delete", "Cancel"],
  defaultId: 1, // focused button index
  cancelId: 1, // button triggered by Escape
});
// response: 0-based index of clicked button (0 = Delete, 1 = Cancel)
```

---

## Shell Operations (`Utils`)

```typescript
import { Utils } from "electrobun/bun";

// Open a file or folder with the default app (Finder, PDF reader, etc.)
// Electron equivalent: shell.openPath()
Utils.openPath("/Users/me/Documents"); // opens folder in Finder
Utils.openPath("/Users/me/report.pdf"); // opens with default PDF app

// Open URL in default browser
// Electron equivalent: shell.openExternal()
Utils.openExternal("https://example.com");
Utils.openExternal("mailto:support@example.com");

// Move file/folder to trash
Utils.moveToTrash("/path/to/file.txt");

// Show file in folder (reveal in Finder)
Utils.showItemInFolder("/path/to/file.txt");
```

---

## Application Menu (`ApplicationMenu`)

```typescript
import { ApplicationMenu } from "electrobun/bun";

ApplicationMenu.setApplicationMenu([
  {
    label: "Chronicles",
    submenu: [
      { role: "about" },
      { type: "separator" },
      {
        label: "Preferences",
        action: "open-preferences",
        accelerator: "Cmd+,",
      },
      { type: "separator" },
      { role: "quit" },
    ],
  },
  {
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "selectAll" },
    ],
  },
  {
    label: "View",
    submenu: [{ role: "reload" }, { role: "toggleDevTools" }],
  },
]);

// Listen for menu item clicks
ApplicationMenu.on("application-menu-clicked", (event) => {
  const { action, data } = event as any;
  if (action === "open-preferences") {
    // handle it
  }
});
```

### MenuItem Config

```typescript
type MenuItemConfig =
  | { type: "divider" | "separator" }
  | {
      type?: "normal";
      label?: string;
      action?: string; // custom action identifier
      role?: string; // system role: "quit", "copy", "paste", etc.
      data?: unknown; // arbitrary data passed back in click event
      submenu?: MenuItemConfig[];
      enabled?: boolean;
      checked?: boolean;
      hidden?: boolean;
      accelerator?: string; // e.g. "Cmd+," or "Ctrl+Shift+I"
      tooltip?: string;
    };
```

---

## Context Menu (`ContextMenu`)

```typescript
import { ContextMenu } from "electrobun/bun";

// Show context menu (triggered from RPC call from webview usually)
ContextMenu.showContextMenu([
  { label: "Copy", role: "copy" },
  { label: "Paste", role: "paste" },
  { type: "separator" },
  {
    label: "Inspect Element",
    action: "inspect-element",
  },
]);

// Listen for clicks
ContextMenu.on("context-menu-clicked", (event) => {
  const { action } = event as any;
  if (action === "inspect-element") {
    win.webview.openDevTools();
  }
});
```

**Note:** Context menus are triggered from the Bun side. The webview sends an RPC message to bun, which calls `showContextMenu`. This replaces `electron-context-menu`.

---

## Paths (`PATHS`)

```typescript
import { PATHS } from "electrobun/bun";

// Standard OS directories
PATHS.paths.home; // /Users/username
PATHS.paths.appData; // ~/Library/Application Support (macOS)
PATHS.paths.config; // ~/Library/Application Support (macOS)
PATHS.paths.cache; // ~/Library/Caches (macOS)
PATHS.paths.temp; // /var/folders/.../T/
PATHS.paths.logs; // ~/Library/Logs (macOS)
PATHS.paths.documents; // ~/Documents
PATHS.paths.downloads; // ~/Downloads
PATHS.paths.desktop; // ~/Desktop
PATHS.paths.pictures; // ~/Pictures

// App-scoped directories (uses app identifier + channel from version.json)
PATHS.paths.userData; // ~/Library/Application Support/{identifier}/{channel}
PATHS.paths.userCache; // ~/Library/Caches/{identifier}/{channel}
PATHS.paths.userLogs; // ~/Library/Logs/{identifier}/{channel}
```

---

## Dark Mode / Native Theme

Electrobun does not have a direct `nativeTheme` API like Electron. Dark mode detection works through:

1. **CSS media query** in the webview: `@media (prefers-color-scheme: dark)` — works automatically
2. **JavaScript** in the webview: `window.matchMedia("(prefers-color-scheme: dark)").matches`
3. **System events**: Listen for `prefers-color-scheme` change events in the webview

For the `setNativeTheme` equivalent (forcing light/dark/system), there is no direct API in Electrobun v1.x. Options:

- Use CSS variables driven by a class on `<html>` that the app manages
- The webview can read and respond to `prefers-color-scheme` automatically via CSS

This means the existing `window.chronicles.setNativeTheme(mode)` behavior may need to be simplified — the "force light/dark" behavior will need to be emulated in the renderer layer rather than at the OS level.

---

## Notifications

```typescript
import { Utils } from "electrobun/bun";

Utils.showNotification({
  title: "Sync Complete",
  body: "All notes synced successfully",
  subtitle: "Chronicles", // shown between title and body on macOS
  silent: false,
});
```

---

## Clipboard

```typescript
import { Utils } from "electrobun/bun";

// Text
const text = Utils.clipboardReadText();
Utils.clipboardWriteText("hello");

// Image (PNG)
const pngData = Utils.clipboardReadImage(); // Uint8Array | null
Utils.clipboardWriteImage(pngUint8Array);

// Clear
Utils.clipboardClear();

// Available formats
const formats = Utils.clipboardAvailableFormats(); // e.g. ["text", "image"]
```

---

## Quit / App Lifecycle

```typescript
import { Utils } from "electrobun/bun";

Utils.quit();  // Gracefully quit the app (triggers beforeQuit event, then native cleanup)

// Dock icon visibility (macOS)
Utils.setDockIconVisible(false);
Utils.isDockIconVisible(): boolean;
```

---

## Global Shortcuts

```typescript
import { GlobalShortcut } from "electrobun/bun";

// (Exact API TBD — check source for current signature)
// GlobalShortcut is exported from electrobun/bun
```

---

## Electron → Electrobun Migration Reference

| Electron API                                                                             | Electrobun Equivalent                                                                       |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `dialog.showOpenDialog({ properties: ["openDirectory"] })`                               | `Utils.openFileDialog({ canChooseDirectory: true, canChooseFiles: false })`                 |
| `dialog.showOpenDialog({ properties: ["openFile"], filters: [{extensions: ["json"]}] })` | `Utils.openFileDialog({ allowedFileTypes: "json", canChooseDirectory: false })`             |
| `shell.openPath(path)`                                                                   | `Utils.openPath(path)`                                                                      |
| `shell.openExternal(url)`                                                                | `Utils.openExternal(url)`                                                                   |
| `nativeTheme.themeSource = "dark"`                                                       | No direct equivalent — manage via CSS/class in renderer                                     |
| `nativeTheme.shouldUseDarkColors`                                                        | `window.matchMedia("(prefers-color-scheme: dark)").matches` in webview                      |
| `app.quit()`                                                                             | `Utils.quit()`                                                                              |
| `Menu.buildFromTemplate(template)` + `Menu.setApplicationMenu(menu)`                     | `ApplicationMenu.setApplicationMenu(items)`                                                 |
| `electron-context-menu` package                                                          | `ContextMenu.showContextMenu(items)` + RPC call from webview                                |
| `electron-store`                                                                         | Roll your own JSON store: `Bun.file(path).json()` / `Bun.write(path, JSON.stringify(data))` |
