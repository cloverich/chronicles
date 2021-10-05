import client from "../client";
import { JournalsStoreV2 } from "./stores/journals2";
export const journalsStoreV2 = new JournalsStoreV2(client);
