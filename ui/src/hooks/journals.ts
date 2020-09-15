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

class JournalsStore {
  private isLoaded: boolean = false;
  @observable loading: boolean = true;
  @observable saving: boolean = false;
  @observable searching: boolean = false;
  @observable error: Error | null = null;
  @observable journals: IJournal[];

  // todo: see reaction in this.load
  @observable query: SearchRequest = { journals: [] };
  private queryReaction: IReactionDisposer | null = null;

  // todo: this interface needs work
  @observable content: Array<[string, string]> = [];

  constructor(private client: Client) {
    this.journals = [];

    // When journals are added or removed, configure a reaction
    // to ensure the active search query makes sense
    reaction(
      () => this.journals,
      (journals) => {
        if (journals.length === 0) {
          // we removed the last journal, clear cached data
          if (this.queryReaction) this.queryReaction();
          this.query = { journals: [] };
          this.content = [];
        } else if (journals.length === 1) {
          // we added or removed, and there is only one journal
          // set default search etc
          this.query = { journals: [journals[0].name] };
          this.watchQuery();
        } else {
          // have > 1 journals, whether add or remove ensure
          // the query does not have a reference to the removed journal.
          for (const journal of this.query.journals) {
            if (!journals.find((j) => j.name === journal)) {
              this.query = { journals: [journals[0].name] };
            }
          }
          this.watchQuery();
        }
      }
    );
  }

  private watchQuery = () => {
    if (this.queryReaction) this.queryReaction();

    // This lets components set the query and the search automatically executes.
    // Probably better to ditch this and let calling `search` be how it all works.
    reaction(
      () => this.query,
      (query) => this.search(query), // todo: confirm... the query is valid?
      { delay: 25, fireImmediately: true }
    );
  };

  load = async () => {
    if (this.isLoaded) return;

    try {
      this.journals = await this.client.journals.list();
      if (this.journals.length > 0) {
        this.query.journals = [this.journals[0].name];
      }
    } catch (err) {
      this.error = err;
    }

    this.watchQuery();
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

  search = async (query: SearchRequest) => {
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

export type IJournalStore = JournalsStore;

export const JournalsContext = React.createContext<JournalsStore>(
  new JournalsStore(client)
);

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
export function useSearch(): Pick<
  JournalsStore,
  "search" | "searching" | "query" | "content"
> {
  const store = useContext(JournalsContext);
  return store;
}
