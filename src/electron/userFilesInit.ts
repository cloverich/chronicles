import path from "path";
import { ensureDir } from "./ensureDir.js";
import { IPreferences } from "./settings.js";
import { ISettingsStore } from "../preload/client/settings-interface.js";

/**
 * Validate user file directories, creating them if they do not exist
 *
 * @param {string} userDataDir - from electron app.getPath('userData');
 *  https://www.electronjs.org/docs/api/app#appgetpathname
 *  on MacOS: ~/Library/Application Support/Chronicles
 * @returns void
 */
export function initUserFilesDir(
  settings: ISettingsStore<IPreferences>,
  fallbackDir: string,
) {
  initDir(settings, "notesDir", path.join(fallbackDir, "/notes"));
  initDir(settings, "settingsDir", fallbackDir);

  // Ensure the themes directory exists inside settingsDir.
  // This is where user-installed theme files will be stored.
  const resolvedSettingsDir = (settings.get("settingsDir") as string) || fallbackDir;
  const themesDir = path.join(resolvedSettingsDir, "themes");
  ensureDir(themesDir);

  // Same for user installed fonts directory.
  const fontsDir = path.join(resolvedSettingsDir, "fonts");
  ensureDir(fontsDir);
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
  settings: ISettingsStore<IPreferences>,
  settingsKey: "notesDir" | "settingsDir",
  fallbackPath: string,
) {
  let assetsPath = settings.get(settingsKey) as string;

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
