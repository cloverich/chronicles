import React from "react";
import { JournalsStoreContext } from "./useJournalsLoader";

/**
 * Simple hepler for accessing the journals store
 */
export function useJournals() {
  const journalsStore = React.useContext(JournalsStoreContext)!;
  return journalsStore;
}
