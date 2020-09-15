import React, { useContext } from "react";
import { withLoading, Loadable, SavingState, Setter } from "./loadutils";
import { IJournal, SearchResponse, SearchRequest } from "../client";
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

import { JournalsStore } from "./stores/journals";
import { SearchStore } from "./stores/search";
import { journalsStore, searchStore } from "./context";

export const JournalsContext = React.createContext<JournalsStore>(
  journalsStore
);

export const SearchContext = React.createContext<SearchStore>(searchStore);

export function useJournals() {
  const store = useContext(JournalsContext);
  return store;
}
