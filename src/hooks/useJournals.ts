import React from "react";
import { ApplicationContext } from "./useApplicationLoader";

/**
 * Simple hepler for accessing the journals store
 */
export function useJournals() {
  const applicationStore = React.useContext(ApplicationContext)!;
  return applicationStore.journals;
}
