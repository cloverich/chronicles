import client from "../client";
import { JournalsStore } from "./stores/journals";
export const journalsStoreV2 = new JournalsStore(client);
