import esbuild from "esbuild";
import fs from "fs";
import path from "path";

function findTestFiles(dir, files = []) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((dirent) => {
    const res = path.resolve(dir, dirent.name);
    if (dirent.isDirectory()) {
      findTestFiles(res, files);
    } else if (
      dirent.name.endsWith(".test.ts") ||
      dirent.name.endsWith(".electron-test.ts")
    ) {
      files.push(res);
    }
  });
  return files;
}

const testFiles = findTestFiles("src");

testFiles.forEach(async (file) => {
  // Maintain electron-test suffix when bundling, so they can be picked up
  // by the electron runner
  let outfile;
  if (file.endsWith(".electron-test.ts")) {
    outfile = file.replace(".electron-test.ts", ".electron-test.bundle.mjs");
  } else {
    outfile = file.replace(".test.ts", ".test.bundle.mjs");
  }

  await esbuild.build({
    entryPoints: [file],
    // NOTE: If changing filename, also update findTestFiles glob above to avoid
    // bundled test files being used as source!
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    external: ["knex", "electron", "electron-store", "better-sqlite3", "sharp"],
    plugins: [],
    sourcemap: true,
  });
});
