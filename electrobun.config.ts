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
      // IMPORTANT: must be named index.js — launcher hardcodes bun/index.js
      entrypoint: "dist/electrobun/index.js",
    },
    views: {
      main: {
        entrypoint: "src/electrobun/views/main/index.ts",
      },
    },
    copy: {
      "src/electrobun/views/main/index.html": "views/main/index.html",
    },
  },
  scripts: {
    preBuild: "scripts/build-electrobun-main.ts",
  },
} satisfies ElectrobunConfig;
