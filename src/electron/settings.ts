import Store from "electron-store";
import { IPreferences, PREFERENCES_DEFAULTS } from "./preferences-types";

export type { IPreferences };

// NOTE: Factory supports tests; application code should use the default export
export const createSettings = (settingsDir?: string) => {
  return new Store<IPreferences>({
    name: "settings",
    defaults: PREFERENCES_DEFAULTS,
    clearInvalidConfig: true,
    ...(settingsDir ? { cwd: settingsDir } : {}),
  });
};

// If CHRONICLES_SETTINGS_DIR is set, use it as the cwd for electron-store.
// This allows tests and scripts to isolate settings per run.
const store = createSettings(process.env.CHRONICLES_SETTINGS_DIR);

export type Settings = Store<IPreferences>;

export default store;
