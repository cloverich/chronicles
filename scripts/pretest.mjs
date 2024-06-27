import esbuild from "esbuild";
import fs from "fs";
import path from "path";

// Function to find test files
function findTestFiles(dir, files = [], ignorePreload = false) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((dirent) => {
    const res = path.resolve(dir, dirent.name);
    if (dirent.isDirectory()) {
      if (!(ignorePreload && res.includes("src/preload"))) {
        findTestFiles(res, files, ignorePreload);
      }
    } else if (dirent.name.endsWith(".test.ts")) {
      files.push(res);
    }
  });
  return files;
}

// Find browser test files, excluding preload directory
const browserTestFiles = findTestFiles("src", [], true);
console.log(browserTestFiles);

// Find preload test files
const preloadTestFiles = findTestFiles("src/preload");
console.log(preloadTestFiles);

// Bundle browser test files
browserTestFiles.forEach(async (file) => {
  await esbuild.build({
    entryPoints: [file],
    outfile: file.replace(".test.ts", ".test.bundle.js"),
    bundle: true,
    platform: "node",
    external: ["mocha"],
    plugins: [],
  });
});

// Bundle preload test files
preloadTestFiles.forEach(async (file) => {
  await esbuild.build({
    entryPoints: [file],
    outfile: file.replace(".test.ts", ".test.bundle.js"),
    bundle: true,
    platform: "node",
    external: ["knex", "electron", "electron-store", "better-sqlite3", "mocha"],
    plugins: [],
  });
});
