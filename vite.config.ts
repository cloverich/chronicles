import tailwindcss from "@tailwindcss/postcss";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  root: "src",
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: "../dist/renderer",
    emptyOutDir: true,
    rollupOptions: {
      input: "src/index.html",
    },
  },
});
