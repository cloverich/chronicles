import Store from "electron-store";
import { IPreferences } from "../../hooks/stores/preferences";

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

  // openDialogImportDir = async () => {
  //   ipcRenderer.send("select-directory");

  //   return new Promise<string>((resolve, reject) => {
  //     ipcRenderer.once("directory-selected", (event, arg) => {
  //       if (arg.error) {
  //         reject(arg.error);
  //       } else {
  //         resolve(arg.value);
  //       }
  //     });
  //   });
  // };

  // openDialogNotesDir = async () => {
  //   ipcRenderer.send("select-directory");

  //   return new Promise<{ error?: string; value?: string }>(
  //     (resolve, reject) => {
  //       ipcRenderer.once("directory-selected", (event, arg) => {
  //         if (arg.error) {
  //           reject(arg.error);
  //         } else if (!arg.value) {
  //           resolve({ value: undefined });
  //         } else {
  //           this.set("notesDir", arg.value);
  //           resolve(arg.value);
  //         }
  //       });
  //     },
  //   );
  // };
}
