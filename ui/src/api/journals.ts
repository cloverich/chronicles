import { Database, recreateSchema } from "./database";
import { Indexer } from "./indexer";

interface IJournal {
  // path to root folder
  url: string;
  // display name
  name: string;
}

/**
 * The Journals service knows how to CRUD journals and calls
 * out to index them when a new journal is added.
 */
export class Journals {
  private idxService: Indexer;
  private db: Database;
  private journals: IJournal[] = [];

  private constructor(db: Database) {
    this.db = db;
    this.idxService = new Indexer(db);
  }

  static async create(db: Database) {
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
    const { count } = this.db
      .prepare(
        "select count(*) as count from journals where name = :name OR url = :url"
      )
      .get({ name: journal.name, url: journal.url });

    if (count !== 0) {
      return "Name or url already exists";
    }

    return null;
  };

  add = async (journal: IJournal) => {
    // add to journals table, if not exists
    const reason = await this.exists(journal);
    if (reason) {
      return this.journals;
    }

    this.db
      .prepare("INSERT INTO journals (name, url) VALUES (:name, :url)")
      .run(journal);

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
    const rows = this.db.prepare("SELECT id,name,url FROM journals").all();

    for (const { id, name, url } of rows) {
      journals.push({
        name,
        url,
      });
    }

    this.journals = journals;
    return journals;
  };
}
