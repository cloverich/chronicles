import { ipcRenderer } from "electron";
import Store from "electron-store";
import { IPreferences } from "../../hooks/stores/preferences";

export interface PreferencesLegacy {
  DATABASE_URL: string;
  DEFAULT_JOURNAL: string | null;
  ARCHIVED_JOURNALS: Record<string, boolean>;
  NOTES_DIR: string;
  SETTINGS_DIR: string;
  ONBOARDING: "new" | "complete";
  DARK_MODE: "light" | "dark" | "system";
}

const defaults = (): IPreferences => ({
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
  mcp: {
    enabled: false,
    socketPath: "~/.chronicles/mcp.sock",
  },
});

export type IPreferencesClient = PreferencesClient;

export class PreferencesClient {
  constructor(private settings: Store<IPreferences>) {
    this.settings = settings;
    this.migrateV1V2();
  }

  migrateV1V2 = async () => {
    [
      ["ARCHIVED_JOURNALS", "archivedJournals"],
      ["DEFAULT_JOURNAL", "defaultJournal"],
      ["DATABASE_URL", "databaseUrl"],
      ["NOTES_DIR", "notesDir"],
      ["SETTINGS_DIR", "settingsDir"],
      ["ONBOARDING", "onboarding"],
      ["DARK_MODE", "darkMode"],
    ].forEach(([oldKey, newKey]) => {
      if (this.settings.get(oldKey as any) !== undefined) {
        this.settings.set(newKey, this.settings.get(oldKey as any));
        this.settings.delete(oldKey as any);
      }
    });
  };

  settingsPath = () => this.settings.path;

  all = async (key?: keyof IPreferences): Promise<IPreferences> => {
    return this.settings.store as unknown as IPreferences;
  };

  get = async (key: keyof IPreferences): Promise<any> => {
    const setting = this.settings.get(key);
    return setting !== undefined
      ? setting
      : defaults()[key as keyof IPreferences];
  };

  /**
   * So far only used as delete(ARCHIVED_JOURNALS.foo)
   */
  delete = async <T extends keyof IPreferences>(
    key: T | string,
  ): Promise<void> => {
    this.settings.delete(key as T);
  };

  replace = async (prefs: IPreferences) => {
    // NOTE: meant ot be called only by the mobx UI store...
    this.settings.set(prefs);
  };

  setMultiple = async (prefs: Partial<IPreferences>): Promise<void> => {
    this.settings.set(prefs);
    document.documentElement.dispatchEvent(new Event("settingsUpdated"));
  };

  set = async <T extends keyof IPreferences>(
    key: T | string,
    value: any,
  ): Promise<void> => {
    this.settings.set(key, value);

    // todo: wire Preferences mobx store through settings.onDidAnyChange,
    // maybe we can ditch this store entirely and just use interface and
    // ....
    document.documentElement.dispatchEvent(new Event("settingsUpdated"));
  };

  // todo: Likely these can be removed; leaving for now
  // openDialog = () => {
  //   ipcRenderer.send("select-database-file");
  // };

  // openDialogUserFiles = () => {
  //   ipcRenderer.send("select-user-files-dir");
  // };

  openDialogImportDir = async () => {
    ipcRenderer.send("select-directory");

    return new Promise<string>((resolve, reject) => {
      ipcRenderer.once("directory-selected", (event, arg) => {
        if (arg.error) {
          reject(arg.error);
        } else {
          resolve(arg.value);
        }
      });
    });
  };

  openDialogNotesDir = async () => {
    ipcRenderer.send("select-directory");

    return new Promise<{ error?: string; value?: string }>(
      (resolve, reject) => {
        ipcRenderer.once("directory-selected", (event, arg) => {
          if (arg.error) {
            reject(arg.error);
          } else if (!arg.value) {
            resolve({ value: undefined });
          } else {
            this.set("notesDir", arg.value);
            resolve(arg.value);
          }
        });
      },
    );
  };
}
