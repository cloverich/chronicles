import { contextBridge } from "electron";
import { create } from "./client";
import "./utils.electron";

import DB from "better-sqlite3";
import Knex from "knex";

import Store from "electron-store";
const settings = new Store({
  name: "settings",
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

contextBridge.exposeInMainWorld("chronicles", {
  createClient: () => create(db, knex, settings),
});
