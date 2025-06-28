import path from "path";
import { ensureDir } from "./ensureDir.js";
import settings from "./settings.js";

/**
 * Validate user file directories, creating them if they do not exist
 *
 * @param {string} userDataDir - from electron app.getPath('userData');
 *  https://www.electronjs.org/docs/api/app#appgetpathname
 *  on MacOS: ~/Library/Application Support/Chronicles
 * @returns void
 */
export function initUserFilesDir(userDataDir: string) {
  initDir("notesDir", path.join(userDataDir, "/notes"));
  initDir("settingsDir", userDataDir);
}

/**
 * Initialize files / root directories with fallbacks, and ensure they can be read from / written
 * to. No-op if they already exist.
 *
 * @param {string} settingsKey - Key from settings where the path is stored
 * @param {string} fallbackPath - Path (relative to root) to use as default for path at settingsKey
 *  if it does not exist; will be set in settings afterwards
 */
function initDir(
  settingsKey: "notesDir" | "settingsDir",
  fallbackPath: string,
) {
  let assetsPath = settings.get(settingsKey);

  try {
    ensureDir(assetsPath);
  } catch (err) {
    console.log(
      `initDir cannot read or write ${assetsPath}. Falling back to ${fallbackPath} for ${settingsKey}!`,
    );

    assetsPath = fallbackPath;
    ensureDir(assetsPath);
    settings.set(settingsKey, assetsPath);
  }
}
