import { SearchRequest, Client } from "../../client";
import { IReactionDisposer } from "mobx";
import { observable, reaction } from "mobx";
import { IJournalStore } from "./journals";

export type ISearchStore = SearchStore;
export class SearchStore {
  private client: Client;
  private journals: IJournalStore;
  @observable saving: boolean = false;
  @observable searching: boolean = false;
  @observable error: Error | null = null;

  // todo: see reaction in this.load
  @observable query: SearchRequest = { journals: [] };
  private queryReaction: IReactionDisposer | null = null;

  // todo: this interface needs work
  @observable content: Array<[string, string]> = [];

  constructor(journals: IJournalStore, client: Client) {
    this.journals = journals;
    this.client = client;

    // When journals are added or removed, configure a reaction
    // to ensure the active search query makes sense
    reaction(() => this.journals.journals, this.onJournalsChanged);
  }

  /**
   * Reactively update search query when journals are added or removed from
   * journals store; see implementation notes.
   *
   * NOTE: This also handles initialization, e.g. setting up the initial search
   * when the app starts after the JournalsStore finishes loading. Breaking this out
   * into a proper initialization step would be easier to follow and test.
   */
  private onJournalsChanged = (journals: IJournalStore["journals"]) => {
    if (journals.length === 0) {
      // we removed the last journal, clear cached data
      if (this.queryReaction) this.queryReaction();
      this.query = { journals: [] };
      this.content = [];
    } else if (journals.length === 1) {
      // we added or removed, and there is only one journal
      // set default search etc
      // NOTE: This handles both changing to 1 journal, or initialization
      // where this.query = undefined.
      this.query = { journals: [journals[0].name] };
      this.watchQuery();
    } else {
      // First, if this is initialization, set the initial query and we are done:
      // TODO: query: { journals: [] } is a _valid_ query... its just the selectedJournals
      // computed property is _wrong_. Leave it as is for now... fix when implementing
      // search
      if (this.query.journals.length === 0) {
        this.query = { journals: [journals[0].name] };
      } else {
        // Existing query. Ensure it contains no references to removed journals.
        for (const journal of this.query.journals) {
          if (!journals.find((j) => j.name === journal)) {
            this.query = { journals: [journals[0].name] };
          }
        }
      }
      this.watchQuery();
    }
  };

  /**
   * Reactively execute search when this.query changes
   *
   * TODO: I think removing this reaction, and letting client code call
   * search directly is better. The query update reaction could then
   * just call this.search(updatedQuery), and this routine goes away.
   */
  private watchQuery = () => {
    if (this.queryReaction) this.queryReaction();

    // This lets components set the query and the search automatically executes.
    reaction(
      () => this.query,
      (query) => this.search(query),
      { delay: 25, fireImmediately: true }
    );
  };

  private search = async (query: SearchRequest) => {
    this.searching = true;
    try {
      const results = await this.client.docs.search(query);
      this.content = results.docs;
    } catch (err) {
      this.error = err;
    }
    this.searching = false;
  };
}
