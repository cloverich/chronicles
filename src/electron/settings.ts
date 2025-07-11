import Store from "electron-store";

export interface IPreferences {
  databaseUrl: string;
  defaultJournal: string | null;
  archivedJournals: Record<string, boolean>;
  notesDir: string;
  settingsDir: string;
  onboarding: "new" | "complete";
  darkMode: "light" | "dark" | "system";
  fonts: {
    heading?: string;
    heading2?: string;
    heading3?: string;
    body?: string;
    mono?: string;
    systemBody?: string;
    systemHeading?: string;
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
