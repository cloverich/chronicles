/**
 * See https://github.com/electron/electron-rebuild
 * and https://www.electronjs.org/docs/tutorial/using-native-node-modules
 *
 * This file was created specifically to handle re-building sqlite3
 * That is, sqlite3 is a _native_ dependency, and where there is a mis-match
 * between the development nodejs version, and the target electron version of nodejs (v8?),
 * native dependencies need to be re-compiled for the target platform.
 *
 * This is required anytime the app is built and packaged for distribution, so it
 * should be run as part of the build script.
 *
 * The build.sh script could handle this functionality, but it would need to
 * run after node_modules are installed IN the packaged directory
 *
 * This is also true for any additional architecture beyond whatever macos supports.
 */
const { packager } = require("@electron/packager");
const { rebuild } = require("@electron/rebuild");
const path = require("path");

// These arguments are provided by build.sh
const srcDir = process.argv[2];
const outDir = process.argv[3];

if (!srcDir || !outDir) {
  console.error("srcDir and outDir are required arguments to package.js");
  process.exit(1);
}

// sanity
console.log(
  "Electron packager and rebuild, using source directory",
  srcDir,
  "and outputting to",
  outDir,
);

const iconPath = {
  darwin: path.resolve("./icons/out/app.icns"), // macOS
  win32: path.resolve("./icons/out/app.ico"), // Windows
  linux: path.resolve("./icons/out/app-512.png"), // Linux (recommended 512x512 PNG)
}[process.platform];

if (!iconPath) {
  console.error(
    "Unsupported platform -- cannot find application icon",
    platform,
  );
  process.exit(1);
}

packager({
  dir: srcDir,
  out: outDir,
  icon: iconPath,
  // … other options
  // Documentation does this in afterCopy. Why did I do this in afterPrune?
  afterPrune: [
    (buildPath, electronVersion, platform, arch, callback) => {
      console.log("rebuilding...", buildPath, electronVersion, platform, arch);

      // Previously, and after they are fixed:
      rebuild({ buildPath, electronVersion, arch })
        .then(() => callback())
        .catch((error) => {
          console.error("Error rebuilding native dependencies!");
          console.error(error);
          callback(error);
        });
    },
  ],
});
