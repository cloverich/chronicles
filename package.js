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
import { packager } from "@electron/packager";
import { rebuild } from "@electron/rebuild";
import path from "path";

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
  osxSign: true,
  icon: iconPath,
  // Unpack native modules from asar so they can load their native binaries.
  // sharp depends on @img/sharp-libvips-* for the actual libvips dylib,
  // so we need to unpack the entire @img scope to preserve relative paths.
  asar: {
    unpack: "**/node_modules/{@img/**,better-sqlite3/**}",
  },
  // Documentation does this in afterCopy. Why did I do this in afterPrune?
  // Note: @electron/packager v19 changed hooks to use object args instead of positional
  afterPrune: [
    async ({ buildPath, electronVersion, platform, arch }) => {
      console.log("rebuilding...", buildPath, electronVersion, platform, arch);

      try {
        await rebuild({ buildPath, electronVersion, arch });
      } catch (error) {
        console.error("Error rebuilding native dependencies!");
        console.error(error);
        throw error;
      }
    },
  ],
});
