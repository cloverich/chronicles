# Evaluate and Migrate Renderer to Vite

## Overview

Evaluate migrating the renderer build from esbuild to Vite while keeping esbuild for main/preload processes.

**Strategic Context:** This migration is a framework-agnostic foundational layer that supports the current Electron app and the future **Custom Swift + WebView (Hybrid)** roadmap (see `docs/designs/framework-comparison-2026.md`).

## Current Setup Analysis

The build system currently uses esbuild for all three bundles:

- **Renderer** (`src/index.tsx` → `src/renderer.bundle.mjs`) - React app
- **Preload** (`src/preload/index.ts` → `src/preload.bundle.mjs`) - IPC bridge
- **Main** (`src/electron/index.ts` → `src/main.bundle.mjs`) - Electron main process

### Current Pain Points

1. **No HMR** - Every renderer change requires full Electron restart (scripts/dev.mjs:59-79)
2. **CSS pre-compilation** - Tailwind must be compiled before starting (package.json:16)
3. **Slow feedback loop** - Even small CSS changes trigger full restart; new Tailwind utility classes (including arbitrary variants) require restart to take effect (see `docs/editor/styling.md`)
4. **Type checking overhead** - Runs separately on each rebuild (scripts/dev.mjs:81-90)

## Why Vite for Renderer Makes Sense

### Major Benefits

1. **Hot Module Replacement (HMR)**

   - Renderer changes reload instantly without restarting Electron
   - CSS changes apply immediately (~50ms vs current ~2-5 seconds)
   - React Fast Refresh preserves component state during development

2. **Integrated CSS Processing**

   - No need to pre-compile Tailwind (remove prestart script)
   - PostCSS, CSS modules, imports all work out-of-box
   - Better source maps for CSS debugging

3. **Superior Developer Experience**

   - Faster cold starts (pre-bundling with esbuild under the hood)
   - Better error overlay in browser
   - Source maps that actually work reliably
   - DevTools integration

4. **Better Production Builds**

   - Advanced code-splitting and tree-shaking
   - Built-in asset optimization (images, fonts)
   - CSS extraction and minification
   - Modern/legacy bundle generation

5. **Ecosystem & Future-Proofing**
   - De facto standard for React development in 2025
   - Rich plugin ecosystem (React, Tailwind, TypeScript all first-class)
   - Active development and community support

### Why Keep esbuild for Main/Preload

- **Speed** - esbuild is still fastest for simple Node.js bundling
- **Simplicity** - Main/preload don't need dev servers or HMR
- **Native modules** - Better handling of better-sqlite3, sharp, etc.
- **No overhead** - Minimal config, minimal bundle size

## Migration Plan

### Phase 1: Add Vite for Renderer (Keep esbuild for main/preload)

#### 1. Install Dependencies

```bash
yarn add -D vite @vitejs/plugin-react vite-plugin-electron-renderer
```

#### 2. Create `vite.config.ts`

```typescript
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import renderer from "vite-plugin-electron-renderer";

export default defineConfig({
  plugins: [
    react(),
    renderer(), // Enables Node.js API in renderer if needed
  ],
  root: "src",
  base: "./",
  build: {
    outDir: "../dist",
    emptyOutDir: false, // Don't delete main/preload bundles
    rollupOptions: {
      input: "src/index.html",
    },
  },
  server: {
    port: 5173,
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  css: {
    postcss: "./postcss.config.js", // For Tailwind
  },
});
```

#### 3. Create `postcss.config.js` (for Tailwind v4)

```javascript
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

#### 4. Update `src/index.html`

```html
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Chronicles</title>
    <!-- Remove pre-compiled CSS, Vite will inject -->
    <meta http-equiv="Content-Security-Policy" content="..." />
  </head>
  <body style="background-color: #1c1d22">
    <main id="app"></main>
    <!-- Vite handles this automatically in dev, bundles for prod -->
    <script type="module" src="/index.tsx"></script>
  </body>
</html>
```

#### 5. Update `scripts/dev.mjs`

- Start Vite dev server for renderer
- Keep esbuild watchers for main and preload
- Update startElectron to pass VITE_DEV_SERVER_URL env var
- Remove watchRenderer() call

Key changes:

```javascript
import { createServer } from "vite";

// Start Vite dev server for renderer
const viteServer = await createServer({
  configFile: "./vite.config.ts",
});
await viteServer.listen();

const VITE_DEV_SERVER_URL = `http://localhost:5173`;

// Update startElectron to use Vite dev server
function startElectron() {
  eprocess = cp.spawn(`${electron}`, ["src/main.bundle.mjs"], {
    stdio: "inherit",
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL, // Main process loads from this URL
    },
  });
}

watchMain();
watchPreload();
// Remove watchRenderer() - Vite handles this
```

#### 6. Update Main Process (`src/electron/index.ts`)

```typescript
// In window creation:
const isDev = !!process.env.VITE_DEV_SERVER_URL;

mainWindow = new BrowserWindow({
  // ... existing config
});

if (isDev) {
  mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  mainWindow.webContents.openDevTools();
} else {
  mainWindow.loadFile("index.html");
}
```

#### 7. Update `build.sh`

Replace:

```bash
node ./scripts/production.js
```

With:

```bash
node ./scripts/build-main-preload.js  # esbuild for main/preload
vite build                              # Vite for renderer
```

Create new `scripts/build-main-preload.js` with just the main and preload builds from `scripts/production.js`.

#### 8. Update `package.json` scripts

```json
{
  "scripts": {
    "start": "node ./scripts/dev.mjs",
    "prestart": "", // Remove Tailwind pre-compilation
    "build": "./build.sh",
    "prebuild": "yarn lint && node ./scripts/icons.js"
  }
}
```

### Phase 2: Optimize (Optional)

#### A. Use `electron-vite` (opinionated framework)

- Handles main/preload/renderer with Vite
- Convention-based config
- Built-in best practices

```bash
yarn add -D electron-vite
```

#### B. Add Type Checking Plugin

```typescript
// vite.config.ts
import checker from "vite-plugin-checker";

plugins: [
  react(),
  checker({ typescript: true }), // Type check during dev
];
```

#### C. Code Splitting

```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'slate': ['slate', 'slate-react', 'slate-history'],
        'plate': [/^@platejs/],
        'radix': [/^@radix-ui/],
      },
    },
  },
}
```

## Migration Complexity

**Effort Level: Medium** (~4-8 hours)

**Breakdown:**

1. Install deps and create configs: 30 min
2. Update dev.mjs to use Vite dev server: 1-2 hours
3. Update main process window loading: 30 min
4. Update build.sh and production scripts: 1 hour
5. Testing and debugging: 2-4 hours (CSP issues, path issues, etc.)

## Risks & Considerations

- **Content Security Policy** - May need to adjust CSP for Vite dev server
- **Path resolution** - Electron protocol handlers might need updates
- **Native modules** - Should be fine (they're in main/preload), but test sharp/better-sqlite3
- **CSS imports** - Font loading paths might need adjustment

## Files to Examine

- `src/electron/index.ts` - Window creation logic
- `src/preload/client/types.ts` - Ensure types still work
- Any custom protocol handlers for `chronicles://`

## Recommendation

**Proceed with Phase 1** - The development experience improvement alone justifies the migration. HMR will make CSS/React development 10x faster, and we'll be on modern tooling with better community support.

Start with the hybrid approach (Vite for renderer, esbuild for main/preload), then consider electron-vite later if you want full Vite for all processes.

---

## Follow-On: Vitest

Once Vite owns the renderer bundle (Phase 1 complete), migrating to **Vitest** becomes the natural next step. This is not optional — it's **required for the testing strategy** outlined in [docs/designs/testing-philosophy.md](docs/designs/testing-philosophy.md).

### Why Vitest is Required

The editor (Plate/SlateJS) requires **real browser** testing — `contenteditable` and Slate's selection APIs are unreliable in jsdom. Vitest's browser mode (`@vitest/browser`, backed by Playwright) runs tests in real Chromium without needing the full Electron app. This is currently **blocking component tests** per [docs/testing.md](docs/testing.md).

### Benefits

- **Vitest shares the Vite config** (no separate transform setup)
- **Instant test re-runs via HMR**
- **Browser mode for editor component testing** (architecturally required)
- **Much faster than Jest** for component-heavy test suites

### Framework-Agnostic Investment

The Vitest migration is scoped entirely to the renderer layer (all current tests are renderer-side: stores, markdown parsing, search logic). This means:

- The investment survives any future framework migration (Tauri, Electrobun, etc.)
- Renderer tests would stay Vitest regardless of what wraps the frontend
- See `docs/designs/framework-comparison-2026.md` for framework migration analysis

---

**Architecture:** Electron + React + TypeScript + MobX + Slate/Plate.js local-first markdown editing notes app
