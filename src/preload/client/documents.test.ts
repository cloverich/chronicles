import { test, suite, before } from "mocha";
import { create } from "../client";

// migrate a temporary db file
// over-ride the electron store setup in client

// client index (src/preload/client/index.ts)
// const settings = new Store({
//   name: "settings",
// });

// // todo: validation, put this somewhere proper
// const db = DB(settings.get("DATABASE_URL") as string);

// I need to overide the DATABASE_URL before importing the client

import DB from "better-sqlite3";
import Knex from "knex";
import Store from "electron-store";

function setupClient() {
  const settings = new Store({
    name: "settings-test",
  });

  // todo: validation, put this somewhere proper
  const db = DB(settings.get("DATABASE_URL") as string);

  type IDB = ReturnType<typeof DB>;

  // Added knex for search which required lots of query mix and
  // matching
  // todo: migrate codebase to prefer knex to directly using
  // the better-sqlite3 client
  const knex = Knex({
    client: "better-sqlite3", // or 'better-sqlite3'
    connection: {
      filename: settings.get("DATABASE_URL") as string,
    },
  });

  return create(db, knex, settings);
}

suite("client.documents", function () {
  before("Setup database", function () {
    setupClient();
  });

  test("loads", function () {
    throw "Hello mocha";
  });
});
