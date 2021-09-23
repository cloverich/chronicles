import ky from "ky-universal";
type Ky = typeof ky;

export interface Preferences {
  DATABASE_URL: string;
  PREFERENCES_FILE: string;
}

export class PreferencesClient {
  constructor(private ky: Ky) {}

  get = (): Promise<Preferences> => {
    return this.ky("v2/preferences").json();
  };

  update = (preferences: Preferences): Promise<any> => {
    return this.ky("v2/preferences", {
      method: "post",
      json: preferences,
    }).json();
  };
}
