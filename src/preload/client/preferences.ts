import { ipcRenderer } from "electron";
import Store from "electron-store";

export interface Preferences {
  DATABASE_URL: string;
  DEFAULT_JOURNAL: string | null;
  ARCHIVED_JOURNALS: Record<string, boolean>;
  NOTES_DIR: string;
  SETTINGS_DIR: string;
}

const defaults = (): Preferences => ({
  DATABASE_URL: "",
  DEFAULT_JOURNAL: null,
  ARCHIVED_JOURNALS: {},
  NOTES_DIR: "",
  SETTINGS_DIR: "",
});

export type IPreferencesClient = PreferencesClient;

export class PreferencesClient {
  constructor(private settings: Store) {}

  settingsPath = () => this.settings.path;

  all = async (key?: keyof Preferences): Promise<Preferences> => {
    return this.settings.store as unknown as Preferences;
  };

  get = async <T extends keyof Preferences>(key: T | string): Promise<any> => {
    const setting = this.settings.get(key);
    return setting !== undefined
      ? setting
      : defaults()[key as keyof Preferences];
  };

  delete = async <T extends keyof Preferences>(
    key: T | string,
  ): Promise<void> => {
    this.settings.delete(key);
  };

  set = async <T extends keyof Preferences>(
    key: T | string,
    value: any,
  ): Promise<void> => {
    this.settings.set(key, value);
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
        console.log("directory-selected", arg);
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
            this.set("NOTES_DIR", arg.value);
            resolve(arg.value);
          }
        });
      },
    );
  };

  setArchivedJournals = async (journals: string[]) => {
    this.settings.set("ARCHIVED_JOURNALS", journals);
  };
}
