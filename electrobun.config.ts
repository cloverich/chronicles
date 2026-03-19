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
      entrypoint: "src/electrobun/main.ts",
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
} satisfies ElectrobunConfig;
