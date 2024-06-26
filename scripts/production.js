const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

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

// Find preload test files
const preloadTestFiles = findTestFiles("src/preload");

// Bundle browser test files
browserTestFiles.forEach(async (file) => {
  await esbuild.build({
    entryPoints: [file],
    outfile: file.replace(".test.ts", ".test.bundle.js"),
    bundle: true,
    platform: "node", // NOTE: this differs from the build script, which uses "browser", b/c we're running tests in Node
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
    external: ["knex", "electron", "electron-store", "better-sqlite3"],
    plugins: [], // Include any necessary plugins here
  });
});
