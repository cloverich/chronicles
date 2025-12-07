import { makeObservable, observable } from "mobx";
import { BulkOperationsStore } from "./BulkOperationsStore";
import { JournalsStore } from "./journals";
import { Preferences } from "./preferences";
import { SyncStore } from "./sync";

export class ApplicationStore {
  preferences: Preferences;
  journals: JournalsStore;
  sync: SyncStore;
  bulkOperations: BulkOperationsStore;

  isPreferencesOpen: boolean;

  constructor(
    preferences: Preferences,
    journals: JournalsStore,
    sync: SyncStore,
    bulkOperations: BulkOperationsStore,
  ) {
    this.preferences = preferences;
    this.journals = journals;
    this.sync = sync;
    this.bulkOperations = bulkOperations;
    this.isPreferencesOpen = false;

    makeObservable(this, {
      isPreferencesOpen: observable,
    });
  }

  togglePreferences = (state: boolean) => {
    if (state) {
      this.isPreferencesOpen = state;
    } else {
      this.isPreferencesOpen = !this.isPreferencesOpen;
    }
  };
}

export interface IApplicationState {
  loading: boolean;
  loadingErr: Error | null;
  applicationStore: null | ApplicationStore;
}
