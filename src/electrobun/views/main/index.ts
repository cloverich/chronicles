import Electrobun, { Electroview } from "electrobun/view";
import { installChroniclesShim } from "../../chronicles-shim";
import type { ChroniclesRPC } from "../../rpc-schema";

// 1. Set up Electroview RPC (no webview→bun handlers needed yet)
const rpc = Electroview.defineRPC<ChroniclesRPC>({
  maxRequestTime: 30000, // Match bun-side timeout for slow operations
  handlers: {
    requests: {},
    messages: {},
  },
});

const view = new Electrobun.Electroview({ rpc });

// 2. Install window.chronicles shim — must happen BEFORE the React app loads
installChroniclesShim(view.rpc!);

console.log("[Chronicles/Electroview] RPC bridge installed");

// 3. Load the React app
const isDev = new URLSearchParams(location.search).has("dev");

if (isDev) {
  // Dev mode: inject Vite dev server scripts for HMR
  const VITE_URL = "http://localhost:5173";

  const viteClient = document.createElement("script");
  viteClient.type = "module";
  viteClient.src = `${VITE_URL}/@vite/client`;
  document.head.appendChild(viteClient);

  const viteApp = document.createElement("script");
  viteApp.type = "module";
  viteApp.src = `${VITE_URL}/src/index.tsx`;
  document.body.appendChild(viteApp);

  console.log(
    `[Chronicles/Electroview] Dev mode — loading Vite from ${VITE_URL}`,
  );
} else {
  // Production: the bundled React app will be loaded separately
  // TODO: Wire production React bundle loading
  console.log("[Chronicles/Electroview] Production mode");
}
