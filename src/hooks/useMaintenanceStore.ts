import React from "react";
import { ApplicationContext } from "./useApplicationStore";

/**
 * Simple helper for accessing the maintenance store
 */
export function useMaintenanceStore() {
  const applicationStore = React.useContext(ApplicationContext)!;
  return applicationStore.maintenance;
}
