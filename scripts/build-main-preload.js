import esbuild from "esbuild";

// CommonJS deps bundled into an ESM output (e.g. yaml's require("process"))
// need a real require; esbuild only emits a throwing shim otherwise.
const cjsRequireBanner = {
  js: 'import { createRequire } from "module"; const require = createRequire(import.meta.url);',
};

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
  banner: cjsRequireBanner,
  external: ["knex", "electron", "electron-store", "better-sqlite3", "sharp"],
  plugins: [afterBuild("preload")],
});

await esbuild.build({
  entryPoints: ["src/electron/index.ts"],
  outfile: "src/main.bundle.mjs",
  bundle: true,
  format: "esm",
  banner: cjsRequireBanner,
  platform: "node",
  external: ["electron", "electron-store", "better-sqlite3"],
  plugins: [afterBuild("main")],
});
