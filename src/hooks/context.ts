import client from "../client";
import { JournalsStore } from "./stores/journals";
import { JournalsStoreV2 } from "./stores/journals2";
import { SearchStore } from "./stores/search";

// TODO: Couldn't these be consolidated with setting up React context objects,
// and then consolidated into the stores directory (index file)?
export const journalsStore = new JournalsStore(client);
export const searchStore = new SearchStore(journalsStore, client);
export const journalsStoreV2 = new JournalsStoreV2(client);
