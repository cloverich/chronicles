import Store from "electron-store";

export interface Preferences {
  DATABASE_URL: string;
  PREFERENCES_FILE: string;
}

export class PreferencesClient {
  constructor(private settings: Store) {}

  get = async (): Promise<Preferences> => {
    const settingsJson = this.settings.store;
    return settingsJson as unknown as Preferences;
  };
}
