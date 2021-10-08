import ky from "ky-universal";
type Ky = typeof ky;
import Store from "electron-store";

export interface Preferences {
  DATABASE_URL: string;
  PREFERENCES_FILE: string;
}

export class PreferencesClient {
  constructor(private ky: Ky, private settings: Store) {}

  get = async (): Promise<Preferences> => {
    const settingsJson = this.settings.store;
    return settingsJson as unknown as Preferences;
    // return this.ky("v2/preferences").json();
  };

  // update = (preferences: Preferences): Promise<any> => {

  //   return this.ky("v2/preferences", {
  //     method: "post",
  //     json: preferences,
  //   }).json();
  // };
}