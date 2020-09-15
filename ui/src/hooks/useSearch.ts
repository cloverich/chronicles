import { useContext } from "react";
import { SearchStore } from "./stores/search";
import { SearchContext } from "./useJournals";

/**
 * Use the searchStore :\
 */
export function useSearch(): SearchStore {
  const store = useContext(SearchContext);
  return store;
}
