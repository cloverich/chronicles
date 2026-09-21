import tailwindcss from "@tailwindcss/postcss";
import react from "@vitejs/plugin-react";
import { execFileSync } from "child_process";
import path from "path";
import { defineConfig } from "vite";

function git(...args: string[]): string {
  try {
    return execFileSync("git", args, {
      cwd: __dirname,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function buildMetadata() {
  const changelog = JSON.parse(
    execFileSync("node", ["scripts/changelog.mjs", "--build-info"], {
      cwd: __dirname,
      encoding: "utf8",
    }),
  ) as { raw: string[]; truncated: boolean };
  const lastTag = git("describe", "--tags", "--abbrev=0") || null;
  const commit = git("rev-parse", "HEAD") || "unknown";
  const shortCommit = commit === "unknown" ? commit : commit.slice(0, 7);
  const commitsAfterTag = Number(
    lastTag
      ? git("rev-list", "--count", `${lastTag}..HEAD`)
      : git("rev-list", "--count", "HEAD"),
  );
  const dirty = Boolean(git("status", "--porcelain"));
  const buildDate = new Date().toISOString().slice(0, 10);
  const stableVersion = lastTag?.replace(/^v/, "") ?? "0.0.0";
  const [major = "0", minor = "0", patch = "0"] = stableVersion.split(".");
  const version =
    commitsAfterTag > 0 || dirty
      ? `${major}.${Number(minor) + 1}.${patch}-dev-${commitsAfterTag}-${buildDate.replace(/-/g, "")}-${shortCommit}`
      : stableVersion;

  return {
    version,
    commit,
    shortCommit,
    lastTag,
    commitsAfterTag,
    buildDate,
    dirty,
    raw: changelog.raw,
    truncated: changelog.truncated,
  };
}

export default defineConfig({
  define: {
    __CHRONICLES_BUILD__: JSON.stringify(buildMetadata()),
  },
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
