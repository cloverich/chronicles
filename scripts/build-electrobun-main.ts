#!/usr/bin/env bun
/**
 * Pre-bundles the Electrobun main process entry point using Bun.build().
 *
 * Electrobun's CLI uses `bun build --app` internally, which triggers Bun's
 * HTML bundler. That bundler fails on our dependency tree because the markdown
 * pipeline transitively imports React/Slate editor components (via
 * src/markdown/index.ts → ../views/edit/editorv2/...). The standard
 * Bun.build({ target: "bun" }) handles this fine.
 *
 * This script runs as Electrobun's preBuild hook, producing a single
 * dist/electrobun/main.js that Electrobun then wraps into the app bundle.
 */

import { mkdirSync } from "fs";
import { resolve } from "path";

mkdirSync("dist/electrobun", { recursive: true });

// Resolve project root (where this script lives is scripts/)
const projectRoot = resolve(import.meta.dir, "..");

const result = await Bun.build({
  entrypoints: ["src/electrobun/index.ts"],
  outdir: "dist/electrobun",
  target: "bun",
  sourcemap: "external",
  // electrobun/bun is a runtime-provided module (like bun:sqlite) —
  // it must NOT be bundled; it resolves inside the Electrobun launcher.
  external: ["electrobun", "electrobun/bun", "electrobun/view"],
  // Inject project root so bundled code can find assets (migrations, etc.)
  define: {
    "process.env.CHRONICLES_PROJECT_ROOT": JSON.stringify(projectRoot),
  },
});

if (!result.success) {
  console.error("Pre-bundle failed:");
  for (const msg of result.logs) {
    console.error(msg);
  }
  process.exit(1);
}

console.log(
  "[build-electrobun-main] Pre-bundled main.ts →",
  result.outputs.map((o) => o.path).join(", "),
);
