import { observable, computed, reaction } from "mobx";
import { IJournalStore, ISearchStore } from "../hooks/journals";
import { useLocalStore } from "mobx-react-lite";
import { useJournals, useSearch } from "../hooks/journals";
import { useEventListener } from "../hooks/useEventListener";

interface EditingArgs {
  journal: string;
  date?: string;
}

export interface CustomDetailevent {
  detail: {
    depth: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
    content: string; // ex: ## todo heading
  };
}

export function useViewModel() {
  const journals = useJournals();
  const search = useSearch();
  const store = useLocalStore(() => new JournalsViewModel(journals, search));

  // Extract filter from event, and call setter
  const setFilterHandler = (ev: CustomDetailevent) => {
    store.setFilter(ev.detail);
  };

  // Downstream, setting filter indicated by clicking on
  // a heading. This fires a custom event, since the component
  // is disconnected. Probably better to just put a setter into
  // the context and not use a custom event.
  useEventListener("focus-heading", setFilterHandler);

  return { store, journals, search };
}

class JournalsViewModel {
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

export type IJournalsViewModel = JournalsViewModel;
