import React, { useContext } from "react";
import { create, Client } from "../preload/client";
export { Client } from "../preload/client";
export { JournalResponse } from "../preload/client/journals";
export { SearchResponse } from "../preload/client/documents";

export const ClientContext = React.createContext<Client>(create());
ClientContext.displayName = "ClientContext";

export default function useClient() {
  return useContext(ClientContext);
}
