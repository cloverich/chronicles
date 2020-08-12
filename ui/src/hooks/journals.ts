import React, { useState, useEffect, useContext } from "react";
import { withLoading, Loadable, SavingState, Setter } from "./loadutils";
import client, {
  IJournal,
  SearchResponse,
  SearchRequest,
  Client,
} from "../client";
import { useClient } from "../client/context";

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
  @observable journals: IJournal[] = [];

  // todo: see reaction in this.load
  @observable query: SearchRequest = { journals: [] };

  // todo: this interface needs work
  @observable content: Array<[string, string]> = [];

  constructor(private client: Client) {}

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

    reaction(
      () => this.query,
      (query) => this.search(query),
      { delay: 25, fireImmediately: true }
    );

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

export const JournalsContext = React.createContext<JournalsStore>(
  new JournalsStore(client)
);

export function useJournals() {
  const store = useContext(JournalsContext);
  return store;
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
