const esbuild = require("esbuild");

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
  outfile: "src/renderer.bundle.js",
  bundle: true,
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
  outfile: "src/preload.bundle.js",
  bundle: true,
  platform: "node",
  external: ["knex", "electron", "electron-store", "better-sqlite3"],
  plugins: [afterBuild("preload")],
});

// build electron main bundle
esbuild.build({
  entryPoints: ["src/electron/index.js"],
  outfile: "src/main.bundle.js",
  bundle: true,
  platform: "node",
  external: ["electron", "electron-store", "better-sqlite3"],
  plugins: [afterBuild("main")],
});
