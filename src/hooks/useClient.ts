import React, { useContext } from "react";
import type { IClient } from "../preload/client/types";

export type {
  IClient,
  JournalResponse,
  SearchResponse,
} from "../preload/client/types";

/** Legacy service client; injected at the app root (src/index.tsx). */
export const ClientContext = React.createContext<IClient | null>(null);

ClientContext.displayName = "ClientContext";

/**
 * Hook to get the client that separates "server side" from the UI.
 *
 * Note that this is the only safe place for UI code to access the client.
 */
export default function useClient(): IClient {
  const client = useContext(ClientContext);
  if (!client) {
    throw new Error("[chronicles] useClient() called outside a ClientContext");
  }
  return client;
}
