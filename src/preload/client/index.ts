import DB from "better-sqlite3";
import Knex, { Knex as KnexType } from "knex";
import { settings } from "../settings";
import { DocumentsClient } from "./documents";
import { FilesClient } from "./files";
import { ImporterClient } from "./importer";
import { runTests } from "./importer/test";
import { JournalsClient } from "./journals";
import { PreferencesClient } from "./preferences";
import { SyncClient } from "./sync";
import { TagsClient } from "./tags";
import { IClient } from "./types";

// Global variables to store initialized clients
let db: DB.Database;
let knex: KnexType;

// Initialize database connections asynchronously
async function initializeDatabase() {
  if (!db) {
    const databaseUrl = await settings.get("databaseUrl");
    if (!databaseUrl) {
      throw new Error("Database URL not set in settings");
    }

    db = DB(databaseUrl);

    knex = Knex({
      client: "better-sqlite3",
      connection: {
        filename: databaseUrl,
      },
      // https://knexjs.org/guide/query-builder.html#insert
      // don't replace undefined with "DEFAULT" in insert statements; replace
      // it with NULL instead (SQLite raises otherwise)
      useNullAsDefault: true,
    });
  }
}

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

export async function create(): Promise<IClient> {
  if (!client) {
    await initializeDatabase();

    const preferences = new PreferencesClient(settings);
    const files = new FilesClient(settings);
    const journals = new JournalsClient(knex, files, preferences);
    const documents = new DocumentsClient(db, knex, files, preferences);
    const sync = new SyncClient(
      db,
      knex,
      journals,
      documents,
      files,
      preferences,
    );

    const importer = new ImporterClient(
      knex,
      documents,
      files,
      preferences,
      sync,
    );

    client = {
      journals: journals,
      documents: documents,
      tags: new TagsClient(knex),
      preferences: preferences,
      files: files,
      sync,
      importer,
      tests: new TestsClient(),
    };
  }

  return client;
}
