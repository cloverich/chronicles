import Store from "electron-store";

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

const defaults: IPreferences = {
  databaseUrl: "",
  defaultJournal: null,
  archivedJournals: {},
  notesDir: "",
  settingsDir: "",
  onboarding: "new",
  darkMode: "system",
  themeLightName: "System Light",
  themeDarkName: "System Dark",
  codeThemeLight: "github",
  codeThemeDark: "github-dark",
  fonts: {
    heading:
      '"Hubot Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
    heading2: undefined, // defaults to heading
    heading3: undefined, // defaults to heading
    body: '"Mona Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
    mono: '"IBM Plex Mono", ui-monospace, SFMono-Regular, "SF Mono", Monaco, Inconsolata, "Roboto Mono", "Noto Sans Mono", "Droid Sans Mono", "Courier New", monospace',
    systemBody:
      '"Mona Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
    systemHeading:
      '"Hubot Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
    searchBody: undefined, // defaults to systemBody
  },
  maxWidth: {
    prose: "768px",
    code: undefined,
  },
  fontSizes: {
    search: "16px",
    body: "1rem",
    heading: "1.5rem",
    title: "3rem",
  },
};

// NOTE: Factory supports tests; application code should use the default export
export const createSettings = (settingsDir?: string) => {
  return new Store<IPreferences>({
    name: "settings",
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
