import Conf from "conf";
import { syncFolderContaining } from "./sync-folders";

import {
  IPreferences,
  PREFERENCES_DEFAULTS,
} from "../electron/preferences-types";

export { PREFERENCES_DEFAULTS };
export type { IPreferences };

/**
 * Bun-client replacement for PreferencesClient (was electron-store backed).
 * Backed by `conf` (the same library that backs electron-store), which handles
 * prototype-pollution-safe dotted-path access and atomic writes.
 * Same API surface as the Electron version, minus browser-only dispatchEvent calls.
 */
export class PreferencesClient {
  constructor(private conf: Conf<IPreferences>) {}

  /**
   * The live notes directory must not live in a sync-service folder: those
   * services lock, evict, and conflict-copy files modified after they are
   * written. Only checked when the value changes, so an existing setting
   * keeps working. Backups belong there instead (see the Backups page).
   */
  private assertNotesDir = (next: unknown) => {
    if (typeof next !== "string" || next === this.conf.get("notesDir")) return;
    const service = syncFolderContaining(next);
    if (service) {
      throw new Error(
        `[NOTES_DIR_IN_SYNC_FOLDER] The notes folder cannot be inside ${service}. Choose a local folder, and point backups at ${service} instead.`,
      );
    }
  };

  settingsPath = (): string => this.conf.path;

  all = async (_key?: keyof IPreferences): Promise<IPreferences> => {
    return this.conf.store as IPreferences;
  };

  get = async (key: keyof IPreferences): Promise<any> => {
    return this.conf.get(key);
  };

  /**
   * Supports dotted-path delete, e.g. delete("archivedJournals.foo")
   */
  delete = async <T extends keyof IPreferences>(
    key: T | string,
  ): Promise<void> => {
    this.conf.delete(key as T);
  };

  replace = async (prefs: IPreferences): Promise<void> => {
    this.assertNotesDir(prefs.notesDir);
    this.conf.store = prefs;
  };

  setMultiple = async (prefs: Partial<IPreferences>): Promise<void> => {
    this.assertNotesDir(prefs.notesDir);
    this.conf.set(prefs as IPreferences);
    // Note: no document.dispatchEvent — not a browser environment
  };

  set = async <T extends keyof IPreferences>(
    key: T | string,
    value: any,
  ): Promise<void> => {
    if (key === "notesDir") this.assertNotesDir(value);
    this.conf.set(key as string, value);
    // Note: no document.dispatchEvent — not a browser environment
  };
}

export type IPreferencesClient = PreferencesClient;
