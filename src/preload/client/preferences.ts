import Store from "electron-store";
import { ipcRenderer } from "electron";

export interface Preferences {
  DATABASE_URL: string;
  PREFERENCES_FILE: string;
  DEFAULT_JOURNAL_ID: string;
}

export type IPreferencesClient = PreferencesClient;

export class PreferencesClient {
  constructor(private settings: Store) {}

  get = async (): Promise<Preferences> => {
    const settingsJson = this.settings.store;
    return settingsJson as unknown as Preferences;
  };

  // todo: Ideally this could go into a preload script
  // see the main script (electron/index) for the other half
  openDialog = () => {
    ipcRenderer.send("select-database-file");
  };

  openDialogUserFiles = () => {
    ipcRenderer.send("select-user-files-dir");
  };

  setDefaultJournal = async (journalId: string) => {
    this.settings.set("DEFAULT_JOURNAL_ID", journalId);
  };
}
