import esbuild from "esbuild";
import fs from "fs";
import path from "path";

function findTestFiles(dir, files = []) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((dirent) => {
    const res = path.resolve(dir, dirent.name);
    if (dirent.isDirectory()) {
      findTestFiles(res, files);
    } else if (dirent.name.endsWith(".test.ts")) {
      files.push(res);
    }
  });
  return files;
}

const testFiles = findTestFiles("src");

testFiles.forEach(async (file) => {
  await esbuild.build({
    entryPoints: [file],
    outfile: file.replace(".test.ts", ".test.bundle.js"),
    bundle: true,
    platform: "node",
    external: ["mocha"],
    plugins: [],
  });
});
