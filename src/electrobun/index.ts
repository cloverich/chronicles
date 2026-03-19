import { ApplicationMenu, BrowserWindow, Utils } from "electrobun/bun";
import { createRPC } from "./rpc-handlers";

import { readFileSync } from "fs";
import { resolve } from "path";

console.log("[Chronicles/Electrobun] Starting...");

// Dev mode: load Vite directly. Prod: load bundled views.
const isDev = process.env.NODE_ENV !== "production";
const url = isDev ? "http://localhost:5173" : "views://main/index.html";

// Create typed RPC bridge — all window.chronicles methods are wired here
const rpc = createRPC();

// In dev mode, we load localhost:5173 directly (same-origin with Vite's module system).
// The Electroview RPC + chronicles shim must run before the React app, so we inject
// the bundled view JS as a preload script.
let preload: string | null = null;
if (isDev) {
  try {
    // Read the bundled view JS that Electrobun produced
    // import.meta.dir = .../Resources/app/bun/
    const viewJsPath = resolve(
      import.meta.dir,
      "../views/main/index.js",
    );
    preload = readFileSync(viewJsPath, "utf-8");
    console.log(`[Chronicles/Electrobun] Loaded preload script (${preload.length} bytes)`);
  } catch (err) {
    console.error("[Chronicles/Electrobun] Failed to load preload:", err);
  }
}

const win = new BrowserWindow({
  title: "Chronicles",
  frame: { x: 100, y: 100, width: 900, height: 800 },
  url,
  titleBarStyle: "hiddenInset",
  rpc,
  preload,
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
// Electrobun event shape: { name, data: { detail: JSON string }, _response, responseWasSet }
win.webview.on("will-navigate", (event: any) => {
  let navUrl: string | undefined;
  try {
    const detail = JSON.parse(event?.data?.detail ?? "{}");
    navUrl = detail.url;
  } catch {
    return;
  }
  if (!navUrl) return;
  // Allow our own dev server and views
  if (
    navUrl.startsWith("http://localhost:") ||
    navUrl.startsWith("views://")
  ) {
    return;
  }
  // Open external URLs in default browser
  if (
    navUrl.startsWith("http://") ||
    navUrl.startsWith("https://") ||
    navUrl.startsWith("mailto:")
  ) {
    Utils.openExternal(navUrl);
  }
});

// Open devtools automatically in dev mode
if (isDev) {
  win.webview.openDevTools();
}

console.log(`[Chronicles/Electrobun] Window created, loading ${url}`);
