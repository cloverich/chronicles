import Store from "electron-store";
import { APPEARANCE_DEFAULTS } from "./appearance-defaults";

export interface IPreferences {
  databaseUrl: string;
  defaultJournal: string | null;
  archivedJournals: Record<string, boolean>;
  notesDir: string;
  settingsDir: string;
  onboarding: "new" | "complete";
  darkMode: "light" | "dark" | "system";
  /** Name of the theme to use in light mode. Defaults to the built-in "System Light" theme. */
  themeLightName: string;
  /** Name of the theme to use in dark mode. Defaults to the built-in "System Dark" theme. */
  themeDarkName: string;
  /** highlight.js theme name for code blocks in light mode. */
  codeThemeLight: string;
  /** highlight.js theme name for code blocks in dark mode. */
  codeThemeDark: string;
  fonts: {
    heading?: string;
    heading2?: string;
    heading3?: string;
    title?: string;
    body?: string;
    mono?: string;
    systemBody?: string;
    systemHeading?: string;
    searchBody?: string;
  };
  maxWidth: {
    prose?: string;
    code?: string;
    frontmatter?: string;
  };
  fontSizes: {
    search?: string;
    body?: string;
    heading?: string;
    title?: string;
  };
}

export const defaults: IPreferences = {
  databaseUrl: "",
  defaultJournal: null,
  archivedJournals: {},
  notesDir: "",
  settingsDir: "",
  onboarding: "new",
  ...APPEARANCE_DEFAULTS,
};

// NOTE: Factory supports tests; application code should use the default export
export const createSettings = (settingsDir?: string) => {
  return new Store<IPreferences>({
    name: "settings",
    projectName: "Chronicles",
    defaults,
    clearInvalidConfig: true,
    ...(settingsDir ? { cwd: settingsDir } : {}),
  });
};

// If CHRONICLES_SETTINGS_DIR is set, use it as the cwd for electron-store.
// This allows tests and scripts to isolate settings per run.
const store = createSettings(process.env.CHRONICLES_SETTINGS_DIR);

export type Settings = Store<IPreferences>;

export default store;
