import { Electroview } from "electrobun/view";
import { installChroniclesShim } from "../../chronicles-shim";
import type { ChroniclesRPC } from "../../rpc-schema";

// Define webview-side RPC (no handlers needed yet — all calls go webview→bun direction)
const electroview = Electroview.defineRPC<ChroniclesRPC>({
  handlers: {
    requests: {},
    messages: {},
  },
});

const view = new Electroview({ rpc: electroview });

// Install window.chronicles shim that routes through RPC
installChroniclesShim(view.rpc);

console.log("[Chronicles/Electroview] RPC bridge installed");
