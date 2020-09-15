import React, { useState, useEffect, useContext } from "react";
import { withLoading, Loadable, SavingState, Setter } from "./loadutils";
import client, {
  IJournal,
  SearchResponse,
  SearchRequest,
  Client,
} from "../client";
import { useClient } from "../client/context";
import { IReactionDisposer } from "mobx";

export type JournalsState = SavingState & {
  journals: IJournal[];
  addJournal: (journal: IJournal, propagate: boolean) => any;
  removeJournal: (journal: IJournal) => Promise<void>;
};

/**
 * Maybe "Journal State" would be a better description, but I
 * already used that name. Revisit later.
 */
export type SearchState = Loadable & {
  query: SearchRequest | undefined;
  setQuery: Setter<SearchRequest | undefined>;
  content: SearchResponse | undefined;
};

import { observable, reaction } from "mobx";

export type ISearchStore = SearchStore;

class SearchStore {
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
      (query) => this.search(query), // todo: confirm... the query is valid?
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

class JournalsStore {
  private isLoaded: boolean = false;
  @observable loading: boolean = true;
  @observable saving: boolean = false;
  @observable error: Error | null = null;
  @observable journals: IJournal[];

  constructor(private client: Client) {
    this.journals = [];
  }

  load = async () => {
    if (this.isLoaded) return;

    try {
      this.journals = await this.client.journals.list();
    } catch (err) {
      this.error = err;
    }

    this.isLoaded = true;
    this.loading = false;
  };

  remove = async (journal: IJournal) => {
    this.saving = true;
    try {
      this.journals = await this.client.journals.remove(journal);
    } catch (err) {
      this.error = err;
    }
    this.saving = false;
  };

  add = async (journal: IJournal) => {
    this.saving = true;
    try {
      this.journals = await this.client.journals.add(journal);
    } catch (err) {
      this.error = err;
    }
    this.saving = false;
  };
}

export type IJournalStore = JournalsStore;

const journalsStore = new JournalsStore(client);
const searchStore = new SearchStore(journalsStore, client);

export const JournalsContext = React.createContext<JournalsStore>(
  journalsStore
);

export const SearchContext = React.createContext<SearchStore>(searchStore);

export function useJournals() {
  const store = useContext(JournalsContext);
  return store;
}

/**
 * Get a single journal by name.
 *
 * Requires the store be loaded with journals first, but will helpfully throw an error
 * and blow up the UI if it hasn't.
 *
 * @param journalName
 */
export function useJournal(journalName: string) {
  const store = useContext(JournalsContext);
  const [journal, setJournal] = useState(() =>
    store.journals.find((journal) => journal.name == journalName)
  );
  if (!journal)
    throw new Error(
      `useJournal called with ${journalName} but that journal was not found in the store. Instead found ${store.journals.map(
        (j) => j.name
      )}`
    );

  useEffect(() => {
    setJournal(store.journals.find((journal) => journal.name == journalName));
  }, [journalName]);

  return journal;
}

/**
 * ...this is so much simpler than the prior version. Jesus.
 */
export function useSearch(): SearchStore {
  const store = useContext(SearchContext);
  return store;
}
