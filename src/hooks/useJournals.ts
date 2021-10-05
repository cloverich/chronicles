import React, { useContext } from "react";
import { JournalsStoreV2 } from "./stores/journals2";
import { journalsStoreV2 } from "./context";

export const JournalsStoreV2Context =
  React.createContext<JournalsStoreV2>(journalsStoreV2);
export function useJournalsV2() {
  return useContext(JournalsStoreV2Context);
}
