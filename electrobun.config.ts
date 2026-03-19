import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "Chronicles",
    identifier: "dev.chronicles.app",
    version: "1.0.0",
  },
  runtime: {
    exitOnLastWindowClosed: false, // macOS: keep app alive when windows closed
  },
  build: {
    bun: {
      // Pre-bundled by scripts/build-electrobun-main.ts to work around
      // Electrobun's `bun build --app` HTML bundler failing on the markdown
      // pipeline's transitive React/Slate imports.
      entrypoint: "dist/electrobun/main.js",
    },
    views: {
      // Electroview entry — sets up RPC + window.chronicles shim before React loads
      main: {
        entrypoint: "src/electrobun/views/main/index.ts",
      },
    },
    copy: {
      "src/electrobun/views/main/index.html": "views/main/index.html",
    },
  },
  scripts: {
    // Pre-bundle main.ts with Bun.build (target: bun) before Electrobun runs
    preBuild: "scripts/build-electrobun-main.ts",
  },
} satisfies ElectrobunConfig;
