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

// https://github.com/sindresorhus/electron-store/issues/15
// docs are good: https://github.com/sindresorhus/electron-store
// todo: JSON Schema, etc
export default new Store<IPreferences>({
  name: "settings",
});
