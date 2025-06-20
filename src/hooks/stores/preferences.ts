import { observable, reaction } from "mobx";
import { IClient } from "../../preload/client/types";

export interface IPreferences {
  databaseUrl: string;
  defaultJournal: string | null;
  archivedJournals: Record<string, boolean>;
  notesDir: string;
  settingsDir: string;
  onboarding: "new" | "complete";
  darkMode: "light" | "dark" | "system";
  fonts?: {
    heading1?: string;
    heading2?: string;
    heading3?: string;
    systemBody?: string;
    systemHeading?: string;
    contentBody?: string;
    code?: string;
  };
}

export class Preferences implements IPreferences {
  client: IClient["preferences"];
  private _lastSynced!: {
    [K in keyof IPreferences]?: IPreferences[K] | null;
  };

  @observable
  databaseUrl!: string;
  @observable
  defaultJournal!: string | null;
  @observable
  archivedJournals!: Record<string, boolean>;
  @observable
  notesDir!: string;
  @observable
  settingsDir!: string;
  @observable
  onboarding!: "new" | "complete";
  @observable
  darkMode!: "light" | "dark" | "system";
  @observable
  fonts?: {
    heading1?: string;
    heading2?: string;
    heading3?: string;
    systemBody?: string;
    systemHeading?: string;
    contentBody?: string;
    code?: string;
  };

  constructor(prefs: IPreferences, client: IClient["preferences"]) {
    Object.assign(this, prefs);
    this._lastSynced = { ...prefs };
    this.client = client;

    reaction(
      () => ({
        databaseUrl: this.databaseUrl,
        defaultJournal: this.defaultJournal,
        archivedJournals: this.archivedJournals,
        notesDir: this.notesDir,
        settingsDir: this.settingsDir,
        onboarding: this.onboarding,
        darkMode: this.darkMode,
        fonts: this.fonts,
      }),
      (prefs: IPreferences) => {
        let toWrite: Partial<IPreferences> = {};

        console.debug("Preferences; Checking for changes to save:", prefs);
        Object.keys(prefs).forEach((key) => {
          // @ts-expect-error TS is being overly precious
          // NEED to shallow compare properly, because for nested objects like archived journals,
          // we need to compare the values, not the references
          if (this.valuesDiffer(this._lastSynced[key], prefs[key])) {
            console.debug(
              // @ts-expect-error TS is being overly precious
              `Preferences: Saving ${key} changed from ${this._lastSynced[key]} to ${prefs[key]}`,
            );
            // @ts-expect-error TS is being overly precious
            this._lastSynced[key] = prefs[key];
            // @ts-expect-error TS is being overly precious
            toWrite[key] = prefs[key];
          }
        });

        toWrite = JSON.parse(JSON.stringify(toWrite));

        if (Object.keys(toWrite).length > 0) {
          console.debug("Preferences: Writing changes to client:", toWrite);
          this.client.setMultiple(toWrite);
        } else {
          console.debug("Preferences: No changes to save.");
        }
      },
      { delay: 1000 }, // debounce the save to avoid too many writes
    );
  }

  private valuesDiffer = (a: any, b: any) => {
    return JSON.stringify(a) !== JSON.stringify(b);
  };

  private save = async () => {
    await this.client.replace(JSON.parse(JSON.stringify(this)));
  };

  refresh = async () => {
    Object.assign(this, await this.client.all());
  };

  static init = async (pref: IClient["preferences"]) => {
    // load remote preferences
    const preferences = await pref.all();

    // todo: watch them?
    return new Preferences(preferences, pref);
  };
}
