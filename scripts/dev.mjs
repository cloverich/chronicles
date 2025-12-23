import cp from "child_process";
import electron from "electron";
import esbuild from "esbuild";
import lodash from "lodash";

// Builds and watches the application for development
// Bundles the renderer, preload, and main processes, and
// starts Electron, then watches for changes

const startTracker = new Set();
let didStart = false;
let lastChange = null; // Track which bundle changed most recently

// esbuild callbacks work as plugins; this one handles (re)starting the electron
// process after the application bundles are built
function startElectronPlugin(name) {
  return {
    name: "(Re)start Electron",
    setup(build) {
      build.onEnd((result) => {
        // NOTE: This will not handle type checking; see type checking call below
        if (result.errors.length) {
          console.error(`${name} bundle completed with errors`, result.errors);
        } else {
          console.log(`${name} bundle completed`);
          startTracker.add(name);
          lastChange = name; // Track which bundle changed
        }

        if (startTracker.size !== 3) return;

        if (didStart) {
          handleBundleChange(lastChange);
        } else {
          didStart = true;
          startElectron();
        }
      });
    },
  };
}

// Handle bundle changes with different strategies based on what changed
function handleBundleChange(bundleName) {
  if (bundleName === "renderer") {
    reloadRenderer();
  } else if (bundleName === "preload") {
    recreateWindow();
  } else if (bundleName === "main") {
    restartElectron();
  }
}

// For holding the spawned Electron main process, so it can
// be .kill()'ed on re-start
let eprocess;

// Start the electron main process (first time)
function startElectron() {
  console.log("starting electron");
  checkTypes();
  eprocess = cp.spawn(`${electron}`, ["src/main.bundle.mjs"], {
    stdio: ["pipe", "inherit", "inherit"], // stdin as pipe for sending commands
  });

  eprocess.on("error", (error) => {
    console.error("electron error", error, error.message);
    process.exit(1);
  });
}

// Send command to reload renderer without restarting
const reloadRenderer = lodash.debounce(() => {
  if (eprocess && eprocess.stdin) {
    console.log("[DEV] Reloading renderer (no restart)...");
    checkTypes();
    eprocess.stdin.write("reload-renderer\n");
  }
}, 200);

// Send command to recreate window (for preload changes)
const recreateWindow = lodash.debounce(() => {
  if (eprocess && eprocess.stdin) {
    console.log("[DEV] Recreating window for preload changes...");
    checkTypes();
    eprocess.stdin.write("recreate-window\n");
  }
}, 200);

// Re-start the main process (for main process changes)
const restartElectron = lodash.debounce(function startElectron() {
  if (eprocess) eprocess.kill("SIGTERM");

  checkTypes();
  console.log("[DEV] Restarting electron (main process changed)...");
  eprocess = cp.spawn(`${electron}`, ["src/main.bundle.mjs"], {
    stdio: ["pipe", "inherit", "inherit"], // stdin as pipe for sending commands
  });

  eprocess.on("error", (error) => {
    console.error("electron error", error, error.message);
    process.exit(1);
  });
}, 200);

const checkTypes = lodash.debounce(function checkTypes() {
  const typesProcess = cp.spawn("yarn", ["tsc", "--noEmit"], {
    stdio: "inherit",
  });

  typesProcess.on("error", (error) => {
    console.error("types error", error, error.message);
    process.exit(1);
  });
}, 200);

async function watchRenderer() {
  const ctxRenderer = await esbuild.context({
    entryPoints: ["src/index.tsx"],
    outfile: "src/renderer.bundle.mjs",
    bundle: true,
    platform: "browser",
    format: "esm",
    plugins: [startElectronPlugin("renderer")],
    sourcemap: true,
    loader: {
      ".woff2": "file",
      ".woff": "file",
      ".ttf": "file",
      ".otf": "file",
    },
    assetNames: "assets/fonts/[name]-[hash]",
  });

  await ctxRenderer.watch();
}

async function watchPreload() {
  const ctxPreload = await esbuild.context({
    entryPoints: ["src/preload/index.ts"],
    outfile: "src/preload.bundle.mjs",
    bundle: true,
    platform: "node",
    format: "esm",
    external: ["knex", "electron", "electron-store", "better-sqlite3", "sharp"],
    plugins: [startElectronPlugin("preload")],
    sourcemap: true,
  });

  await ctxPreload.watch();
}

async function watchMain() {
  const ctxMain = await esbuild.context({
    entryPoints: ["src/electron/index.ts"],
    outfile: "src/main.bundle.mjs",
    bundle: true,
    platform: "node",
    format: "esm",
    external: ["electron", "electron-store", "better-sqlite3"],
    plugins: [startElectronPlugin("main")],
  });

  await ctxMain.watch();
}

watchMain();
watchPreload();
watchRenderer();
