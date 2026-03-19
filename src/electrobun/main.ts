import { ApplicationMenu, BrowserWindow } from "electrobun/bun";

// Dev mode: point at Vite dev server; prod: use bundled views
const isDev = process.env.NODE_ENV !== "production";
const url = isDev ? "http://localhost:5173" : "views://main/index.html";

const win = new BrowserWindow({
  title: "Chronicles",
  frame: { x: 100, y: 100, width: 900, height: 800 },
  url,
  titleBarStyle: "hiddenInset",
  // RPC will be added in Phase 4
});

// Basic application menu with standard Edit operations
ApplicationMenu.setApplicationMenu([
  {
    label: "Chronicles",
    submenu: [
      { role: "about" },
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

// macOS: re-create window when dock icon clicked
// Note: Electrobun handles this via runtime.exitOnLastWindowClosed: false
// The BrowserWindow will be recreated automatically if needed

console.log(`[Chronicles/Electrobun] Window created, loading ${url}`);
