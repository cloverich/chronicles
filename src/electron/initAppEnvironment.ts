import path from "path";
import migrate from "./migrations/index.js";
import { Settings } from "./settings.js";
import { initUserFilesDir } from "./userFilesInit.js";

/**
 * Initializes the application environment: user files directories and database.
 *
 * @param {string} fallbackDir - Directory for user files/settings (typically Electron's app.getPath('userData'))
 * @param {string} [databaseUrl] - Optional database file path. If not provided, defaults to `${userDataDir}/chronicles.db`
 * @returns {{ databaseUrl: string, notesDir: string }}
 */
export function initAppEnvironment(
  settings: Settings,
  fallbackDir: string,
  databaseUrl?: string,
) {
  // 1. Initialize user files directories
  initUserFilesDir(settings, fallbackDir);

  // 2. Determine notesDir from settings (set by initUserFilesDir)
  const notesDir = settings.get("notesDir");

  // 3. Set up the database URL in settings
  let dbUrl = databaseUrl;
  if (!dbUrl) {
    dbUrl = path.join(fallbackDir, "chronicles.db");
  }
  if (settings.get("databaseUrl") !== dbUrl) {
    settings.set("databaseUrl", dbUrl);
  }

  // 4. Run migrations
  migrate(dbUrl);

  return { databaseUrl: dbUrl, notesDir };
}
