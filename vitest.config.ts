import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    __CHRONICLES_BUILD__: JSON.stringify({
      version: "0.13.0-dev",
      commit: "a1b2c3d000000000000000000000000000000000",
      shortCommit: "a1b2c3d",
      lastTag: "v0.12.1",
      commitsAfterTag: 3,
      buildDate: "2026-09-18",
      dirty: false,
      raw: ["2026-09-18 a1b2c3d Example raw commit"],
      truncated: false,
    }),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.vitest.{ts,tsx}"],
    css: true,
  },
});
