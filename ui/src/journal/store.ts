import { observable, computed, reaction } from "mobx";
import { IJournalStore, ISearchStore } from "../hooks/journals";
import { EditingArgs, CustomDetailevent } from "./useUiStore";

export class JournalsUiStore {
  constructor(private store: IJournalStore, private searchStore: ISearchStore) {
    // Update query when adding a new document.
    // So... because I stop editing by setting this.editing = null in a few places..
    // this reaction re-triggers the search query so new entries are picked up by
    // the main view's search results. It works and is performant but god this is awful
    // I am sorry future self.
    // test: Saving a new document updates the main view
    // test: Closing editor without updating (or adding) and entry does not re-trigger
    // a search
    reaction(
      () => this.editing,
      (editing) => {
        if (!editing) this.searchStore.query = { ...this.searchStore.query };
      }
    );
  }

  @observable editing?: EditingArgs;
  @observable filter?: CustomDetailevent["detail"];

  @computed get selectedJournal() {
    return this.searchStore.query.journals[0];
  }
  @computed get hasJournals() {
    return this.store.journals.length;
  }
  @computed get journals() {
    return this.store.journals;
  }

  // todo: rename "Focus" heading
  setFilter = (detail?: CustomDetailevent["detail"]) => {
    // Clear a pinned heading, "Unfocus" heading
    if (!detail) {
      this.searchStore.query = {
        ...this.searchStore.query,
        nodeMatch: undefined,
      };
      this.filter = undefined;
    } else {
      // "Focus" heading
      const { content, depth } = detail;
      this.searchStore.query = {
        ...this.searchStore.query,
        nodeMatch: {
          text: content,
          type: "heading",
          attributes: null,
        },
      };

      this.filter = detail;
    }
  };

  selectJournal = (journal: string) => {
    this.searchStore.query = {
      journals: [journal],
    };

    this.filter = undefined;
  };

  editSelectedJournal = () => {
    // Set the selected journal with no date as editing...
    // which will be interpreted as "load a new entry" by
    // useEditableDocument. Not at all confusing :\
    this.editing = { journal: this.selectedJournal };
  };
}

export type IJournalsViewModel = JournalsUiStore;
