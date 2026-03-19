import Electrobun, { Electroview } from "electrobun/view";
import { installChroniclesShim } from "../../chronicles-shim";
import type { ChroniclesRPC } from "../../rpc-schema";

// 1. Set up Electroview RPC (no webview→bun handlers needed yet)
const rpc = Electroview.defineRPC<ChroniclesRPC>({
  maxRequestTime: 30000,
  handlers: {
    requests: {},
    messages: {},
  },
});

const view = new Electrobun.Electroview({ rpc });

// 2. Install window.chronicles shim — must happen BEFORE the React app loads
installChroniclesShim(view.rpc!);

console.log("[Chronicles/Electroview] RPC bridge installed");

// Forward webview console/errors to bun process via RPC message
function logToBun(msg: string) {
  try {
    (view.rpc as any).send.webviewLog({ message: msg });
  } catch {
    // RPC not ready yet, ignore
  }
}

// Catch all errors and forward to bun process
window.addEventListener("error", (e) => {
  const msg = `[webview error] ${e.message} at ${e.filename}:${e.lineno}`;
  logToBun(msg);
});
window.addEventListener("unhandledrejection", (e) => {
  logToBun(`[webview unhandled rejection] ${e.reason}`);
});

// In dev mode this runs as a preload on localhost:5173 — Vite serves the React
// app directly. In production this runs inside views://main/index.html with
// the bundled React app included.
logToBun("[Electroview] chronicles shim installed, ready for React app");
