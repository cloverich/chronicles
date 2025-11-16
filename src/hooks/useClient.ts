import React, { useContext } from "react";
import { IClient } from "../preload/client/types";

export {
  IClient,
  JournalResponse,
  SearchResponse,
} from "../preload/client/types";

export const ClientContext = React.createContext<IClient>(
  window.chronicles.getClient(),
);

ClientContext.displayName = "ClientContext";

/**
 * Hook to get the client that separates "server side" from the UI.
 *
 * Note that this is the only safe place for UI code to access the client.
 */
export default function useClient() {
  return useContext(ClientContext);
}
