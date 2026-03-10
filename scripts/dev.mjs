import cp from "child_process";
import electron from "electron";
import esbuild from "esbuild";
import lodash from "lodash";
import { createServer } from "vite";

const vite = await createServer({ configFile: "./vite.config.ts" });
await vite.listen();
const VITE_DEV_SERVER_URL =
  vite.resolvedUrls?.local[0] ?? "http://localhost:5173";
console.log(`Vite dev server running at ${VITE_DEV_SERVER_URL}`);

const startTracker = new Set();
let didStart = false;

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
        }

        if (startTracker.size !== 2) return;

        if (didStart) {
          restartElectron();
        } else {
          didStart = true;
          startElectron();
        }
      });
    },
  };
}

// For holding the spawned Electron main process, so it can
// be .kill()'ed on re-start
let eprocess;

// Start the electron main process (first time)
function startElectron() {
  console.log("starting electron");
  checkTypes();
  eprocess = cp.spawn(`${electron}`, ["src/main.bundle.mjs"], {
    stdio: "inherit",
    env: { ...process.env, VITE_DEV_SERVER_URL },
  });

  eprocess.on("error", (error) => {
    console.error("electron error", error, error.message);
    process.exit(1);
  });
}

// Re-start the main process
// todo: This works, but is heavy-handed since it fully re-starts the process each time.
// Ideally renderer code would hot-reload, or merely refresh and load from a dev-server
// instead or restarting electron
const restartElectron = lodash.debounce(function startElectron() {
  if (eprocess) eprocess.kill("SIGTERM");

  // todo: This was a quick hack to get type errors to show up in console. Re-write this as a
  // plugin that checks the relevant types (renderer, preload) and fails the build (and, ideally,
  // is incremental or something, rather than a fresh sub-process)
  checkTypes();
  console.log("restarting electron");
  eprocess = cp.spawn(`${electron}`, ["src/main.bundle.mjs"], {
    stdio: "inherit",
    env: { ...process.env, VITE_DEV_SERVER_URL },
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

await watchMain();
await watchPreload();
