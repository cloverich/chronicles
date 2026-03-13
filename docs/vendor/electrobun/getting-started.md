# Electrobun — Getting Started

> Source: https://blackboard.sh/electrobun/docs/guides/quick-start/
> Fetched from: https://github.com/blackboardsh/electrobun (source of truth)
> Version: v1.x (2026)

## What is Electrobun?

Electrobun is a complete solution-in-a-box for building, updating, and shipping ultra fast, tiny, and cross-platform desktop applications written in TypeScript. Under the hood it uses [Bun](https://bun.sh) to execute the main process and to bundle webview TypeScript, with native bindings written in Zig.

**Project goals:**
- Write TypeScript for the main process and webviews without thinking about it
- Isolation between main and webview processes with fast, typed, easy-to-implement RPC
- Small self-extracting app bundles ~12MB (when using system webview)
- App updates as small as 14KB (bsdiff binary patching between versions)
- Start writing code in 5 minutes and distribute in 10

## Installation

```bash
# Create a new project from template
npx electrobun init

# Or add to an existing Bun project
npm add electrobun
# or
bun add electrobun
```

## Project Structure

A typical Electrobun project looks like:

```
my-app/
├── electrobun.config.ts     # Build + app configuration (REQUIRED)
├── package.json
├── tsconfig.json
├── bun.lock
└── src/
    ├── bun/
    │   └── index.ts         # Main process entry point (Bun)
    └── views/
        └── main/
            ├── index.html   # Webview HTML
            └── index.ts     # Webview TypeScript (bundled by Electrobun)
```

## electrobun.config.ts

This is the central configuration file. It controls app metadata, build pipeline, views, and release settings:

```typescript
import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "My App",
    identifier: "com.example.myapp",   // reverse-DNS bundle ID
    version: "1.0.0",
    urlSchemes: [],                     // custom URL schemes (optional)
  },
  runtime: {
    exitOnLastWindowClosed: true,       // default: true
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts",  // main process entry
    },
    views: {
      // Each key becomes a named view bundle
      "main": {
        entrypoint: "src/views/main/index.ts",
      },
    },
    copy: {
      // Static files to copy into the build output
      "src/views/main/index.html": "views/main/index.html",
    },
    mac: {
      codesign: true,
      notarize: true,
    },
  },
  release: {
    baseUrl: "https://updates.example.com/",
    generatePatch: true,
  },
} satisfies ElectrobunConfig;
```

## Main Process Entry (src/bun/index.ts)

```typescript
import { BrowserWindow } from "electrobun/bun";

const win = new BrowserWindow({
  title: "My App",
  frame: { x: 100, y: 100, width: 1200, height: 800 },
  url: "views://main/index.html",    // production: serves from bundled views
  // url: "http://localhost:5173",   // dev: point at Vite dev server
  titleBarStyle: "hiddenInset",      // macOS: transparent titlebar with inset traffic lights
});
```

## Webview Entry (src/views/main/index.ts)

```typescript
import { Electroview } from "electrobun/view";

// Minimal: no RPC
const electroview = new Electroview({ rpc: undefined });

// With RPC (see rpc.md for full details)
// const electroview = new Electroview({ rpc: myRPC });
```

## Dev vs Production URLs

| Environment | URL pattern |
|-------------|-------------|
| Development | `http://localhost:5173` (Vite dev server) |
| Production  | `views://main/index.html` (bundled assets served by Electrobun) |

The `views://` scheme serves files from the built `views/` directory inside the app bundle.

## Running in Development

```bash
# Build and run (Electrobun bundles everything, then launches)
bun run dev

# Typical package.json scripts
{
  "scripts": {
    "dev": "electrobun dev",
    "build": "electrobun build",
  }
}
```

## Platform Support

| OS | Status |
|----|--------|
| macOS 14+ | Official |
| Windows 11+ | Official |
| Ubuntu 22.04+ | Official |
| Other Linux (GTK3 + WebKit2GTK 4.1) | Community |

## Key Differences from Electron

| | Electron | Electrobun |
|--|----------|------------|
| Runtime | Node.js | Bun |
| Bundle size | ~100MB | ~12MB |
| Startup time | 1-2s | <50ms |
| Webview | Bundled Chromium | System WebView (WebKit on macOS) |
| IPC | contextBridge + ipcMain/ipcRenderer | Typed RPC (see rpc.md) |
| SQLite | better-sqlite3 (native module) | bun:sqlite (built-in) |
| Native modules | npm (with rebuild) | Bun-compatible npm packages |

## Important: System WebView

Electrobun uses the **system WebView** by default (WebKit on macOS, WebView2 on Windows, WebKit2GTK on Linux). This means:

- CSS/JS rendering may differ from Chromium (Electron)
- Test early in Phase 1 for any rendering differences
- CEF (Chromium Embedded Framework) is available as `renderer: "cef"` but increases bundle size

## Apps Built with Electrobun

- [Audio TTS](https://github.com/blackboardsh/audio-tts) — text-to-speech desktop app
- [Co(lab)](https://blackboard.sh/colab/) — hybrid web browser + code editor
- [DOOM](https://github.com/blackboardsh/electrobun-doom) — DOOM port (demonstrates native + TS approaches)
