import { observable, computed, reaction, IObservableArray } from "mobx";
import { ISearchStore } from "../hooks/stores/search";
import { IJournalStore } from "../hooks/stores/journals";
import { EditingArgs, FocusHeadingEvent } from "./useStore";

// todo: define this type on the IJournalUiStore or the SearchStore, since it
// manages this query
import { SearchRequest } from "../client";

// also defined in TagSearchStore
type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

// SearchRequest["nodeMatch"]
type NodeMatch = {
  /**
   * Type of node
   *
   * https://github.com/syntax-tree/mdast#nodes
   */
  type: string; // type of Node
  /**
   * Match one or more attributes of a node
   */
  attributes?: Record<string, string | number>;
  text?: string; // match raw text from within the node
};

export type FilterToken = {
  type: "filter";
  value: NodeMatch;
};

export type JournalToken = {
  type: "in";
  value: string; // keyof Journals
};

export type FocusToken = {
  type: "focus";
  value: {
    type: string;
    content: string;
    depth: HeadingTag;
  };
};

export type SearchToken = FilterToken | JournalToken | FocusToken;

export class JournalsUiStore {
  // todo: searchStore only public to support tagSeachStore... refactor...
  constructor(private store: IJournalStore, public searchStore: ISearchStore) {
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

  @observable sidebarOpen: boolean = false;
  @observable editing?: EditingArgs;
  @observable focusedHeading?: FocusHeadingEvent["detail"];

  @computed get selectedJournals() {
    return this.searchStore.query.journals.slice();
  }
  @computed get hasJournals() {
    return this.store.journals.length;
  }
  @computed get journals() {
    return this.store.journals;
  }
  @computed get isFiltered() {
    if (this.focusedHeading) return false;
    return !!this.searchStore.query.nodeMatch;
  }

  @observable tokens: IObservableArray<SearchToken> = observable([]);

  // setTokens = (tokens: SearchToken[]) => {
  //   this.tokens = tokens;
  // };

  focusHeading = (detail?: FocusHeadingEvent["detail"]) => {
    // Clear a focused heading, "Unfocus" heading
    if (!detail) {
      this.searchStore.query = {
        ...this.searchStore.query,
        nodeMatch: undefined,
      };
      this.focusedHeading = undefined;
    } else {
      // "Focus" heading
      const { content, depth } = detail;
      this.searchStore.query = {
        ...this.searchStore.query,
        nodeMatch: {
          text: content,
          type: "heading",
          attributes: undefined,
        },
      };

      this.focusedHeading = detail;
    }
  };

  // Add and remove
  selectJournal = (journal: string) => {
    this.searchStore.query = {
      journals: [journal],
    };

    this.focusedHeading = undefined;
  };

  editSelectedJournal = () => {
    if (!this.journals.length) {
      // Should not happen
      console.error("Cannot edit journal because no journals exist");
      return;
    }

    // Set the selected journal with no date as editing...
    // which will be interpreted as "create a new document" by
    // useEditableDocument. Not at all confusing :\
    // todo: ¯\_(ツ)_/¯
    this.editing = {
      journal: this.selectedJournals.length
        ? this.selectedJournals[0]
        : this.journals[0].name,
    };
  };
}

export type IJournalsUiStore = JournalsUiStore;
