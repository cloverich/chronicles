import client from "../client";
import { JournalsStore } from "./stores/journals";
import { SearchStore } from "./stores/search";
export const journalsStore = new JournalsStore(client);
export const searchStore = new SearchStore(journalsStore, client);
