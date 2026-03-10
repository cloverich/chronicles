import esbuild from "esbuild";

function afterBuild(name) {
  return {
    name: `after-build-${name}`,
    setup(build) {
      build.onEnd((result) => {
        if (result.errors.length) {
          console.error(`${name} bundle completed with errors`, result.errors);
          process.exit(1);
        } else {
          console.log(`${name} bundle completed`);
        }
      });
    },
  };
}

await esbuild.build({
  entryPoints: ["src/preload/index.ts"],
  outfile: "src/preload.bundle.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  external: ["knex", "electron", "electron-store", "better-sqlite3", "sharp"],
  plugins: [afterBuild("preload")],
});

await esbuild.build({
  entryPoints: ["src/electron/index.ts"],
  outfile: "src/main.bundle.mjs",
  bundle: true,
  format: "esm",
  platform: "node",
  external: ["electron", "electron-store", "better-sqlite3"],
  plugins: [afterBuild("main")],
});
