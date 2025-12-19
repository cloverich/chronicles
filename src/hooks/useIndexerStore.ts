import React from "react";
import { ApplicationContext } from "./useApplicationStore";

/**
 * Simple helper for accessing the indexer store
 */
export function useIndexerStore() {
  const applicationStore = React.useContext(ApplicationContext)!;
  return applicationStore.indexer;
}
