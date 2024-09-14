import React, { useContext } from "react";
import { IClient } from "../preload/client/types";

export { SearchResponse } from "../preload/client/documents";
export { IClient, JournalResponse } from "../preload/client/types";

export const ClientContext = React.createContext<any>(
  (window as any).chronicles.createClient(),
);
ClientContext.displayName = "ClientContext";

/**
 * Hook to get the client that separates "server side" from the UI.
 *
 * Note that this is the only safe place for UI code to access the client.
 */
export default function useClient(): IClient {
  return useContext(ClientContext);
}
