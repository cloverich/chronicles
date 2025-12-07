import React from "react";
import { ApplicationContext } from "./useApplicationStore";

/**
 * Simple helper for accessing the sync store
 */
export function useSyncStore() {
  const applicationStore = React.useContext(ApplicationContext)!;
  return applicationStore.sync;
}
