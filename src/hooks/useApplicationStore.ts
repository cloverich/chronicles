import React from "react";
import { ApplicationStore } from "./stores/application";

export const ApplicationContext = React.createContext<ApplicationStore | null>(
  null,
);

// todo: Allow selecting part of state
export function useApplicationStore(): ApplicationStore {
  const applicationStore = React.useContext(ApplicationContext)!;
  return applicationStore;
}
