import React, { useContext } from "react";
import { IClient } from "../preload/client/types";
export { IClient } from "../preload/client/types";

export { JournalResponse } from "../preload/client/journals";
export { SearchResponse } from "../preload/client/documents";

export const ClientContext = React.createContext<any>(
  (window as any).chronicles.createClient()
);
ClientContext.displayName = "ClientContext";

export default function useClient(): IClient {
  return useContext(ClientContext);
}
