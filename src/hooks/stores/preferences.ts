import { makeObservable, observable, reaction, toJS } from "mobx";
import { IPreferences } from "../../electron/settings";
import { IClient } from "../../preload/client/types";

export class Preferences implements IPreferences {
  client: IClient["preferences"];
  private _lastSynced!: {
    [K in keyof IPreferences]?: IPreferences[K] | null;
  };

  databaseUrl!: string;
  defaultJournal!: string | null;
  archivedJournals!: Record<string, boolean>;
  notesDir!: string;
  settingsDir!: string;
  onboarding!: "new" | "complete";
  darkMode!: "light" | "dark" | "system";
  fonts!: {
    heading?: string;
    heading2?: string;
    heading3?: string;
    body?: string;
    mono?: string;
    systemBody?: string;
    systemHeading?: string;
  };
  maxWidth!: {
    prose?: string;
    code?: string;
  };
  fontSize!: {
    noteTitle?: string;
    noteBody?: string;
  };

  constructor(prefs: IPreferences, client: IClient["preferences"]) {
    Object.assign(this, prefs);
    makeObservable(this, {
      databaseUrl: observable,
      defaultJournal: observable,
      archivedJournals: observable,
      notesDir: observable,
      settingsDir: observable,
      onboarding: observable,
      darkMode: observable,
      fonts: observable,
      maxWidth: observable,
      fontSize: observable,
    });

    this._lastSynced = { ...prefs };
    this.client = client;

    reaction(
      () => ({
        databaseUrl: this.databaseUrl,
        defaultJournal: this.defaultJournal,
        // todo: add test for archived journals syncing with settings store
        archivedJournals: toJS(this.archivedJournals),
        notesDir: this.notesDir,
        settingsDir: this.settingsDir,
        onboarding: this.onboarding,
        darkMode: this.darkMode,
        // todo: add test for fonts syncing with settings store
        fonts: toJS(this.fonts),
        maxWidth: toJS(this.maxWidth),
        fontSize: toJS(this.fontSize),
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

  /**
   * Immediately save specific preferences, bypassing the debounce.
   * Use for critical settings that need to be persisted before other operations.
   *
   * @param prefs - Partial preferences object to save
   */
  saveImmediate = async (prefs: Partial<IPreferences>): Promise<void> => {
    // Update MobX observables
    Object.assign(this, prefs);

    // Update last synced to prevent debounced reaction from re-saving
    Object.assign(this._lastSynced, prefs);

    // Save to disk immediately (bypassing debounce)
    await this.client.setMultiple(prefs);
  };

  refresh = async () => {
    Object.assign(this, await this.client.all());
  };

  static init = async (pref: IClient["preferences"]) => {
    // load remote preferences
    const preferences = await pref.all();

    // note: Watchers are setup in usePreferences
    return new Preferences(preferences, pref);
  };
}
