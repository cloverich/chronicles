import DB from "better-sqlite3";
import Store from "electron-store";
import Knex from "knex";
import { IPreferences } from "../../hooks/stores/preferences";
import { createClient } from "./factory";
import { runTests } from "./importer/test";
import { IClient } from "./types";

// todo: The main process does this same load, BEFORE this is called... and has
// clearInvalidConfig, and defaults. So here we ASSUME things are good... stupid.
const settings = new Store<IPreferences>({
  name: "settings",
});

// todo: validation, put this somewhere proper
const db = DB(settings.get("databaseUrl") as string);

// Added knex for search which required lots of query mix and
// matching
// todo: migrate codebase to prefer knex to directly using
// the better-sqlite3 client
const knex = Knex({
  client: "better-sqlite3", // or 'better-sqlite3'
  connection: {
    filename: settings.get("databaseUrl") as string,
  },
  // https://knexjs.org/guide/query-builder.html#insert
  // don't replace undefined with "DEFAULT" in insert statements; replace
  // it with NULL instead (SQLite raises otherwise)
  useNullAsDefault: true,
});

export { GetDocumentResponse } from "./types";

let client: IClient;

// no CI test runner for electron tests; so exposed via client so they can be called from the app
// todo: run via cli, then via CI
class TestsClient {
  constructor() {}
  runTests = async () => {
    await runTests();
  };
}

export function create(): IClient {
  if (!client) {
    client = createClient({
      db,
      knex,
      store: settings,
      testsClient: new TestsClient(),
    }) as IClient;
  }

  return client;
}
