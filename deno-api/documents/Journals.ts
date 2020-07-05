import { DB } from "../deps.ts";
import { Indexer } from "./Indexer.ts";
import { recreateSchema } from "./db.ts";

interface IJournal {
  // path to root folder
  url: string;
  // display name
  name: string;
}

function one(db: DB, query: string, params: any[] = []) {
  const rows = db.query(query, params);
  for (const row of rows) {
    rows.done();
    return row;
  }

  throw new Error(`no result for query ${query}`);
}

/**
 * The Journals service knows how to CRUD journals and calls
 * out to index them when a new journal is added.
 */
export class Journals {
  private idxService: Indexer;
  private db: DB;
  private journals: IJournal[] = [];

  private constructor(db: DB) {
    this.db = db;
    this.idxService = new Indexer(db);
  }

  static async create(db: DB) {
    const j = new Journals(db);
    await j.list();
    return j;
  }

  pathForJournal = (journalName: string) => {
    const journal = this.journals.find((j) => j.name === journalName);
    if (!journal) {
      throw new Error(
        `Asked pathForJournal for ${journalName}, but ${journalName} not found in ${this.journals}`
      );
    }

    return journal.url;
  };

  private exists = async (journal: IJournal) => {
    const nameRows = this.db.query(
      "select count(*) as count from journals where name = ?",
      [journal.name]
    );

    for (const [count] of nameRows) {
      if (count !== 0) {
        nameRows.done();
        return "Name already exists";
      }
    }

    const urlRows = this.db.query(
      "select count(*) as count from journals where url = ?",
      [journal.url]
    );

    for (const [count] of urlRows) {
      if (count !== 0) {
        urlRows.done();
        return "Url already exists";
      }
    }

    return null;
  };

  add = async (journal: IJournal) => {
    // add to journals table, if not exists
    const reason = await this.exists(journal);
    if (reason) {
      return this.journals;
    }

    const rows = this.db.query(
      "INSERT INTO journals (name, url) VALUES (?, ?)",
      [journal.name, journal.url]
    );

    // rows.
    // if exists, return 204
    await this.idxService.index(journal.url, journal.name);

    // Update this.journals
    this.journals.push(journal);

    // Return the list of journals
    return this.journals;
  };

  reindex = async () => {
    console.log("[Journals.reindex] start");

    // grab current list, then re-set it
    const list = await this.list();
    this.journals = [];

    // faster then deleting one by one
    await recreateSchema(this.db);

    // re-index
    for (const journal of list) {
      console.log("[Journals.reindex] reindexing", journal.name);
      await this.add(journal);
      console.log("[Journals.reindex] completed", journal.name);
    }
    console.log("[Journals.reindex] complete");
  };

  remove = async () => {
    throw new Error("todo");
  };

  list = async () => {
    let journals: Array<IJournal> = [];
    const rows = this.db.query("SELECT id,name,url FROM journals");

    for (const [id, name, url] of rows) {
      journals.push({
        name,
        url,
      });
    }

    this.journals = journals;
    return journals;
  };
}
