import { APPEARANCE_DEFAULTS } from "../electron/appearance-defaults";
import { SettingsStore } from "./settings-store";

/**
 * Re-declared here (from src/electron/settings.ts) to avoid importing
 * electron-store, which has a side-effect instantiation on module load.
 */
export interface IPreferences {
  databaseUrl: string;
  defaultJournal: string | null;
  archivedJournals: Record<string, boolean>;
  notesDir: string;
  settingsDir: string;
  onboarding: "new" | "complete";
  darkMode: "light" | "dark" | "system";
  themeLightName: string;
  themeDarkName: string;
  codeThemeLight: string;
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

/**
 * Bun-client replacement for PreferencesClient (was electron-store backed).
 * Same API surface, minus browser-only dispatchEvent calls.
 */
export class PreferencesClient {
  constructor(private store: SettingsStore<IPreferences>) {}

  settingsPath = (): string => this.store.path;

  all = async (_key?: keyof IPreferences): Promise<IPreferences> => {
    return this.store.store as IPreferences;
  };

  get = async (key: keyof IPreferences): Promise<any> => {
    return this.store.get(key);
  };

  /**
   * Supports dotted-path delete, e.g. delete("archivedJournals.foo")
   */
  delete = async <T extends keyof IPreferences>(
    key: T | string,
  ): Promise<void> => {
    this.store.delete(key as T);
  };

  replace = async (prefs: IPreferences): Promise<void> => {
    this.store.set(prefs);
  };

  setMultiple = async (prefs: Partial<IPreferences>): Promise<void> => {
    this.store.set(prefs);
    // Note: no document.dispatchEvent — not a browser environment
  };

  set = async <T extends keyof IPreferences>(
    key: T | string,
    value: any,
  ): Promise<void> => {
    this.store.set(key as string, value);
    // Note: no document.dispatchEvent — not a browser environment
  };
}

export type IPreferencesClient = PreferencesClient;
