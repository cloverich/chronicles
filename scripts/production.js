import esbuild from "esbuild";

// After successful build, log results
function afterBuild(name) {
  return {
    name: `after-build-${name}`,
    setup(build) {
      build.onEnd((result) => {
        if (result.errors.length) {
          console.error(`${name} bundle completed with errors`, errors);
          process.exit(1);
        } else {
          console.log(`${name} bundle completed`);
        }
      });
    },
  };
}

// build renderer bundle
esbuild.build({
  entryPoints: ["src/index.tsx"],
  outfile: "src/renderer.bundle.mjs",
  bundle: true,
  format: "esm",
  platform: "browser",
  plugins: [afterBuild("renderer")],
  loader: {
    ".woff2": "file",
    ".woff": "file",
    ".ttf": "file",
    ".otf": "file",
  },
  assetNames: "assets/fonts/[name]-[hash]",
});

// build preload bundle
esbuild.build({
  entryPoints: ["src/preload/index.ts"],
  outfile: "src/preload.bundle.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  external: ["knex", "electron", "electron-store", "better-sqlite3", "sharp"],
  plugins: [afterBuild("preload")],
});

// build electron main bundle
esbuild.build({
  entryPoints: ["src/electron/index.ts"],
  outfile: "src/main.bundle.mjs",
  bundle: true,
  format: "esm",
  platform: "node",
  external: ["electron", "electron-store", "better-sqlite3"],
  plugins: [afterBuild("main")],
});
