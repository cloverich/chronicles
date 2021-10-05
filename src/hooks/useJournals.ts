import React, { useContext } from "react";
import { JournalsStore } from "./stores/journals";
import { journalsStoreV2 } from "./context";

export const JournalsStoreV2Context =
  React.createContext<JournalsStore>(journalsStoreV2);
export function useJournalsV2() {
  return useContext(JournalsStoreV2Context);
}
