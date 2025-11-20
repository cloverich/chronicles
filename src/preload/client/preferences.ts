import Store from "electron-store";
import { IPreferences } from "../../electron/settings";

export type IPreferencesClient = PreferencesClient;

export class PreferencesClient {
  constructor(private settings: Store<IPreferences>) {
    this.settings = settings;
  }

  settingsPath = () => this.settings.path;

  all = async (key?: keyof IPreferences): Promise<IPreferences> => {
    return this.settings.store as unknown as IPreferences;
  };

  get = async (key: keyof IPreferences): Promise<any> => {
    return this.settings.get(key);
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
    // NOTE: | string to support nested set, e.g. .set("archivedJournals.foo", true);
    // todo: It breaks types, is that really worth it?
    key: T | string,
    value: any,
  ): Promise<void> => {
    this.settings.set(key, value);

    // todo: wire Preferences mobx store through settings.onDidAnyChange,
    // maybe we can ditch this store entirely and just use interface and
    // ....
    document.documentElement.dispatchEvent(new Event("settingsUpdated"));
  };
}
