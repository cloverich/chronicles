import React, { useContext } from "react";
import { Client } from "./index";

export const ClientContext = React.createContext<Client | undefined>(undefined);
ClientContext.displayName = "ClientContext";

/**
 * Obtain a reference to the API Client for making API calls.
 */
export function useClient() {
  const client = useContext(ClientContext);
  if (!client)
    throw new Error(
      "useClient hook called before client lib was setup in context -- check the ClientContext setup and fixit!"
    );
  return client!;
}
