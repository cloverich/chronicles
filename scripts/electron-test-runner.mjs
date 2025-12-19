// Test runner that spawns Electron subprocess with test file as preload script
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const testMatches = process.argv.slice(2);

// Find all electron test bundles
function findElectronTestBundles(dir, files = []) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((dirent) => {
    const res = path.resolve(dir, dirent.name);
    if (dirent.isDirectory()) {
      findElectronTestBundles(res, files);
    } else if (dirent.name.endsWith(".electron-test.bundle.mjs")) {
      files.push(res);
    }
  });
  return files;
}

const testFiles = findElectronTestBundles(path.join(projectRoot, "src"));

if (testFiles.length === 0) {
  console.log("No electron test files found");
  process.exit(1);
}

console.log(`Found ${testFiles.length} electron test file(s)`);

// Run tests sequentially
async function runTests() {
  for (const testFile of testFiles) {
    if (
      testMatches.length > 0 &&
      !testMatches.some((match) => testFile.includes(match))
    )
      continue;

    const relativeTestFile = path.relative(projectRoot, testFile);
    console.log(`\nRunning: ${relativeTestFile}`);

    const exitCode = await new Promise((resolve) => {
      const electronProcess = spawn(
        "./node_modules/.bin/electron",
        ["./scripts/electron-test-entry.mjs", relativeTestFile],
        {
          stdio: "inherit",
          cwd: projectRoot,
          env: {
            ...process.env,
            ELECTRON_ENABLE_LOGGING: "true",
            NODE_ENV: "test",
          },
        },
      );

      electronProcess.on("close", (code) => {
        resolve(code);
      });

      electronProcess.on("error", (error) => {
        console.error("Electron test process error:", error);
        resolve(1);
      });
    });

    if (exitCode !== 0) {
      console.log(`\nElectron tests failed with exit code: ${exitCode}`);
      process.exit(exitCode);
    }
  }

  console.log(`\nAll ${testFiles.length} electron test file(s) passed!`);
  process.exit(0);
}

runTests();
