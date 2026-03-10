import Conf from "conf";
import path from "path";
import os from "os";
import { createClient } from "../preload/client/factory.js";
import { IPreferences, defaults } from "../electron/settings.js";
import { initAppEnvironment } from "../electron/initAppEnvironment.js";
import { ISettingsStore } from "../preload/client/settings-interface.js";

function getDefaultUserDataDir(): string {
  // Match Electron's app.getPath('userData') for "Chronicles"
  if (process.platform === "darwin") {
    return path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "Chronicles",
    );
  }
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || os.homedir(), "Chronicles");
  }
  // Linux / fallback: XDG_CONFIG_HOME
  return path.join(
    process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"),
    "chronicles",
  );
}

export function bootstrapCli() {
  const userDataDir =
    process.env.CHRONICLES_USER_DATA || getDefaultUserDataDir();
  const settingsDir = process.env.CHRONICLES_SETTINGS_DIR || userDataDir;

  const store = new Conf<IPreferences>({
    configName: "settings",
    cwd: settingsDir,
    defaults,
  }) as unknown as ISettingsStore<IPreferences>;

  // Resolve notesDir and databaseUrl (same logic as initAppEnvironment)
  initAppEnvironment(store, userDataDir);

  return createClient({ store });
}
