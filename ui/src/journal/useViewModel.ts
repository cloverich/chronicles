import { observable, computed } from "mobx";
import { IJournalStore } from "../hooks/journals";
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
  const store = useLocalStore(() => new JournalsViewModel(journals));

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
  constructor(private store: IJournalStore) {}

  @observable editing?: EditingArgs;
  @observable filter?: CustomDetailevent["detail"];

  @computed get selectedJournal() {
    return this.store.query.journals[0];
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
      this.store.query = {
        ...this.store.query,
        nodeMatch: undefined,
      };
      this.filter = undefined;
    } else {
      // "Focus" heading
      const { content, depth } = detail;
      this.store.query = {
        ...this.store.query,
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
    console.log("selectJournal", journal);

    this.store.query = {
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
