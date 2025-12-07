import React from "react";
import { ApplicationContext } from "./useApplicationStore";

export function useBulkOperationsStore() {
  const applicationStore = React.useContext(ApplicationContext)!;
  return applicationStore.bulkOperations;
}
