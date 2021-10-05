import { observable, computed, reaction, IObservableArray } from "mobx";
import { ISearchStore } from "../hooks/stores/search";
import { IJournalStore } from "../hooks/stores/journals";
import { EditingArgs, FocusHeadingEvent } from "./useStore";

// todo: define this type on the IJournalUiStore or the SearchStore, since it
// manages this query
import { SearchRequest } from "../client";
import {
  SearchToken,
  HeadingTag,
  NodeMatch,
} from "../views/documents/search/tokens";

type FocusedHeading = {
  content: string;
  depth: HeadingTag;
};

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
        if (!editing) this.tokens = observable(this.tokens.slice());
      }
    );

    // Re-run the search query anytime the tokens change.
    // fireImmediately -> search as soon as this controller
    // is created.
    reaction(() => this.tokens.slice(), this.onTokensChange, {
      fireImmediately: true,
    });
  }

  @observable sidebarOpen: boolean = false;
  @observable editing?: EditingArgs;
  @computed get focusedHeading() {
    const token = this.tokens.find((t) => t.type === "focus");
    if (!token) return;

    // Typescript thinks `token` can be any SearchToken still
    return token.value as FocusedHeading;
  }

  @computed get filterToken() {
    const token = this.tokens.find((t) => t.type === "filter");
    if (!token) return;

    // Typescript thinks `token` can be any SearchToken still
    return token.value as NodeMatch;
  }

  @computed get selectedJournals(): string[] {
    return this.tokens
      .filter((t) => t.type === "in")
      .map((t) => t.value) as string[];
  }
  @computed get hasJournals() {
    return this.store.journals.length > 0;
  }
  @computed get journals() {
    return this.store.journals;
  }

  @observable tokens: IObservableArray<SearchToken> = observable([]);

  /**
   * React to tokens changing by updating the search query.
   */
  private onTokensChange = (tokens: SearchToken[]) => {
    const query: SearchRequest = {
      journals: [] as string[],
      nodeMatch: undefined as any,
    };

    tokens.forEach((token) => {
      if (token.type === "in") {
        query.journals.push(token.value);
      }
      if (token.type === "focus") {
        query.nodeMatch = {
          type: "heading",
          text: token.value.content,
        };
      }

      if (token.type === "filter") {
        query.nodeMatch = { ...token.value };
      }
    });

    this.searchStore.query = query;
  };

  focusHeading = (heading?: FocusedHeading) => {
    // Clear any existing focused headings, as there may be only one
    this.tokens = observable(this.tokens.filter((t) => t.type !== "focus"));

    if (!heading) return;

    // If a new heading passed, add it
    // And here it should replace any focus headings with this one...
    // whichi annoyingly duplicates logic from the TagSearchStore...
    this.tokens.push({
      type: "focus",
      value: { type: "heading", ...heading },
    });
  };

  /**
   * Search a single journal with no filters
   */
  selectJournal = (journal: string) => {
    this.tokens = observable([{ type: "in", value: journal }]);
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
      journal: this.selectedJournals[0] || this.journals[0].name,
    };
  };
}

export type IJournalsUiStore = JournalsUiStore;
