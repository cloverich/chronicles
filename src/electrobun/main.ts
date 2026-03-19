import { ApplicationMenu, BrowserWindow, Utils } from "electrobun/bun";
import { createRPC } from "./rpc-handlers";

// Always load via views:// so the Electroview RPC + window.chronicles shim
// initialises before the React app. In dev mode, index.ts dynamically injects
// Vite's scripts; in prod the bundled React app is loaded directly.
const isDev = process.env.NODE_ENV !== "production";
const url = isDev
  ? "views://main/index.html?dev=1"
  : "views://main/index.html";

// Create typed RPC bridge — all window.chronicles methods are wired here
const rpc = createRPC();

const win = new BrowserWindow({
  title: "Chronicles",
  frame: { x: 100, y: 100, width: 900, height: 800 },
  url,
  titleBarStyle: "hiddenInset",
  rpc,
});

// Basic application menu with standard Edit operations
ApplicationMenu.setApplicationMenu([
  {
    label: "Chronicles",
    submenu: [{ role: "about" }, { type: "separator" }, { role: "quit" }],
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

// Prevent navigation away from the app — open external links in default browser
win.webview.on("will-navigate", (event: any) => {
  const navUrl = event.url;
  // Allow our own dev server and views
  if (navUrl.startsWith("http://localhost:") || navUrl.startsWith("views://")) {
    return;
  }
  // Open external URLs in default browser
  event.preventDefault();
  if (
    navUrl.startsWith("http://") ||
    navUrl.startsWith("https://") ||
    navUrl.startsWith("mailto:")
  ) {
    Utils.openExternal(navUrl);
  }
});

// macOS: re-create window when dock icon clicked
// Note: Electrobun handles this via runtime.exitOnLastWindowClosed: false
// The BrowserWindow will be recreated automatically if needed

console.log(`[Chronicles/Electrobun] Window created, loading ${url}`);
