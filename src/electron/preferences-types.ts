import { APPEARANCE_DEFAULTS } from "./appearance-defaults";

/**
 * Shape of the persisted preferences object.
 * Kept in a side-effect-free module so both the Electron settings store
 * (src/electron/settings.ts) and the bun-client (src/bun-client/preferences.ts)
 * can import it without pulling in electron-store.
 */
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

export const PREFERENCES_DEFAULTS: IPreferences = {
  databaseUrl: "",
  defaultJournal: null,
  archivedJournals: {},
  notesDir: "",
  settingsDir: "",
  onboarding: "new",
  ...APPEARANCE_DEFAULTS,
};
