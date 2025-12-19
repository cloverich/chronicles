import { makeObservable, observable } from "mobx";
import { BulkOperationsStore } from "./BulkOperationsStore";
import { IndexerStore } from "./indexer";
import { JournalsStore } from "./journals";
import { Preferences } from "./preferences";

export class ApplicationStore {
  preferences: Preferences;
  journals: JournalsStore;
  indexer: IndexerStore;
  bulkOperations: BulkOperationsStore;

  isPreferencesOpen: boolean;

  constructor(
    preferences: Preferences,
    journals: JournalsStore,
    indexer: IndexerStore,
    bulkOperations: BulkOperationsStore,
  ) {
    this.preferences = preferences;
    this.journals = journals;
    this.indexer = indexer;
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
