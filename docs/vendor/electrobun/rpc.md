# Electrobun RPC

> Source: https://blackboard.sh/electrobun/docs/apis/browser-view/ + source code
> Fetched from: https://github.com/blackboardsh/electrobun/tree/main/package/src
> Version: v1.x (2026)

## Overview

Electrobun's RPC system provides **typed, bidirectional communication** between the Bun main process and webviews. Communication goes over an encrypted WebSocket (AES-GCM per webview) with fallback to postMessage.

RPC functions are **asynchronous** — all requests return Promises.

## Architecture

```
Bun process (main)          Webview (browser context)
─────────────────           ──────────────────────────
BrowserView.defineRPC()  ←→  Electroview.defineRPC()
    rpc.request.*()              rpc.request.*()
    rpc.send.*()                 rpc.send.*()
```

Both sides share a **schema type** that defines:

- `bun`: handlers that execute in the Bun process (callable from webview)
- `webview`: handlers that execute in the webview (callable from Bun)

## Step 1: Define the Shared Schema

Create a shared type file (e.g., `src/shared/types.ts`):

```typescript
import type { ElectrobunRPCSchema } from "electrobun/bun";

export type AppRPC = ElectrobunRPCSchema & {
  bun: {
    requests: {
      // Method callable FROM webview, executes IN bun
      getJournals: {
        params: { userId: string };
        response: { id: string; name: string }[];
      };
      openFolderDialog: {
        params?: undefined;
        response: string | null; // selected path or null
      };
    };
    messages: {
      // Fire-and-forget FROM webview TO bun
      logEvent: { event: string; data?: unknown };
    };
  };
  webview: {
    requests: {
      // Method callable FROM bun, executes IN webview
      ping: {
        params?: undefined;
        response: "pong";
      };
    };
    messages: {
      // Fire-and-forget FROM bun TO webview
      themeChanged: { theme: string };
    };
  };
};
```

## Step 2: Bun Side

```typescript
// src/bun/index.ts
import { BrowserWindow } from "electrobun/bun";
import { BrowserView } from "electrobun/bun";
import type { AppRPC } from "../shared/types";

// Define RPC handlers for what bun handles (bun.requests + bun.messages)
const rpc = BrowserView.defineRPC<AppRPC>({
  maxRequestTime: 5000,
  handlers: {
    requests: {
      getJournals: async ({ userId }) => {
        // runs in bun process — can use bun:sqlite, fs, etc.
        return await db.query(
          "SELECT id, name FROM journals WHERE user_id = ?",
          [userId],
        );
      },
      openFolderDialog: async () => {
        const [path] = await Utils.openFileDialog({
          canChooseFiles: false,
          canChooseDirectory: true,
          allowsMultipleSelection: false,
        });
        return path || null;
      },
    },
    messages: {
      logEvent: ({ event, data }) => {
        console.log("[renderer]", event, data);
      },
    },
  },
});

// Pass rpc to BrowserWindow (or BrowserView directly)
const win = new BrowserWindow({
  title: "My App",
  frame: { x: 0, y: 0, width: 1200, height: 800 },
  url: "views://main/index.html",
  rpc,
});

// Call webview-side methods from bun
win.webview.rpc.request.ping().then((result) => {
  console.log(result); // "pong"
});

win.webview.rpc.send.themeChanged({ theme: "dark" });
```

## Step 3: Webview Side

```typescript
// src/views/main/index.ts
import { Electroview } from "electrobun/view";
import type { AppRPC } from "../../shared/types";

// Define RPC handlers for what webview handles (webview.requests + webview.messages)
const electroview = Electroview.defineRPC<AppRPC>({
  handlers: {
    requests: {
      ping: () => "pong",
    },
    messages: {
      themeChanged: ({ theme }) => {
        document.body.dataset.theme = theme;
      },
    },
  },
});

// Initialize Electroview with the RPC
const view = new Electroview({ rpc: electroview });

// Call bun-side methods from webview
const journals = await view.rpc.request.getJournals({ userId: "me" });

// Send a fire-and-forget message to bun
view.rpc.send.logEvent({ event: "page-load" });
```

## Messages vs Requests

|              | Requests                             | Messages              |
| ------------ | ------------------------------------ | --------------------- |
| Direction    | Bidirectional                        | One-way               |
| Return value | `Promise<response>`                  | `void`                |
| Use for      | Queries, operations needing a result | Notifications, events |
| Timeout      | Yes (default 1000ms, configurable)   | No                    |

## BrowserView.defineRPC vs BrowserWindow RPC

Both approaches work. The `rpc` option on `BrowserWindow` gets forwarded to the automatically-created `BrowserView`:

```typescript
// These are equivalent:

// Option A: Pass rpc to BrowserWindow (convenience)
const win = new BrowserWindow({ rpc, ... });
win.webview.rpc.send.themeChanged({ theme: "dark" });

// Option B: Create BrowserView manually and pass rpc directly
const view = new BrowserView({ rpc, windowId: win.id, ... });
view.rpc.send.themeChanged({ theme: "dark" });
```

## Sandbox Mode

When `sandbox: true` is set on `BrowserWindow` or `BrowserView`, **RPC is disabled**. Only basic lifecycle events work. Use sandbox mode for displaying untrusted remote URLs.

```typescript
const win = new BrowserWindow({
  url: "https://untrusted-site.com",
  sandbox: true, // disables all RPC
});
```

## RPCSchema Type Reference

```typescript
// ElectrobunRPCSchema structure:
interface ElectrobunRPCSchema {
  bun: {
    requests: { [method: string]: { params: unknown; response: unknown } };
    messages: { [event: string]: unknown }; // payload type
  };
  webview: {
    requests: { [method: string]: { params: unknown; response: unknown } };
    messages: { [event: string]: unknown };
  };
}
```

## Replacing window.chronicles (Electron → Electrobun)

The existing `window.chronicles` API in Chronicles is implemented via Electron's `contextBridge`. In Electrobun, this is replaced with typed RPC.

**Pattern:** Keep the same `window.chronicles` shape on the renderer side by creating a shim:

```typescript
// src/views/main/chronicles-shim.ts
// (runs in webview, called during app init)

export function installChroniclesShim(
  rpc: ReturnType<typeof Electroview.defineRPC>,
) {
  const view = new Electroview({ rpc });

  window.chronicles = {
    getClient: () => rpc.request.getClient(),
    openDialogSelectDir: () => rpc.request.openDialogSelectDir(),
    selectThemeFile: () => rpc.request.selectThemeFile(),
    // ... etc
  };
}
```

This lets all existing renderer code (`window.chronicles.foo()`) continue working unchanged while the transport switches from Electron IPC to Electrobun RPC.

## Transport Details

- Uses encrypted WebSocket (`ws://localhost:{port}/socket?webviewId={id}`) with per-webview AES-GCM keys
- Falls back to `postMessage` / named pipes if WebSocket is unavailable
- `ws://` is intentional (localhost) — encryption handled at the app layer, TLS is redundant

## Error Handling

Requests automatically reject with `Error("RPC request timed out.")` after `maxRequestTime` (default: 1000ms). Increase it for slow operations:

```typescript
BrowserView.defineRPC<AppRPC>({
  maxRequestTime: 10000,  // 10 seconds
  handlers: { ... },
});
```

Thrown errors in handlers propagate back as rejected promises on the caller side:

```typescript
// bun side
requests: {
  getJournals: async () => {
    throw new Error("Database not initialized");
  };
}

// webview side — receives rejection
try {
  await view.rpc.request.getJournals({ userId: "me" });
} catch (e) {
  console.error(e.message); // "Database not initialized"
}
```
