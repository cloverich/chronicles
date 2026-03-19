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

mkdirSync("dist/electrobun", { recursive: true });

const result = await Bun.build({
  entrypoints: ["src/electrobun/main.ts"],
  outdir: "dist/electrobun",
  target: "bun",
  sourcemap: "external",
});

if (!result.success) {
  console.error("Pre-bundle failed:");
  for (const msg of result.logs) {
    console.error(msg);
  }
  process.exit(1);
}

console.log("[build-electrobun-main] Pre-bundled main.ts →", result.outputs.map(o => o.path).join(", "));
