import { Database, recreateSchema } from "./database";
import { Indexer } from "./indexer";
import { Files } from "./files";
import { ValidationError } from "./errors";

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

  private existsByName = async (journal: string) => {
    const { count } = this.db
      .prepare("select count(*) as count from journals where name = :name")
      .get({ name: journal });

    return count >= 0;
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

    // Avoid auto-creating a new journal directory; require user to
    // explicitly opt-in (currently, via Create Folder option in UI)
    if (!Files.isValidDirectory(journal.url)) {
      throw new ValidationError(
        "Journal.add called with directory that does not exist. Create it first"
      );
    }

    // todo: prior to this, validate directory
    // todo: what if after inserting, the actual indexing fails?
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
    await recreateSchema(this.db, false);

    // re-index
    for (const journal of list) {
      console.log("[Journals.reindex] reindexing", journal.name);
      await this.add(journal);
      console.log("[Journals.reindex] completed", journal.name);
    }
    console.log("[Journals.reindex] complete");
  };

  remove = async (journal: string) => {
    if (!(await this.existsByName(journal))) {
      throw new ValidationError(
        "Journals.remove cannot be called with journal that does not exist"
      );
    }

    // dereference journal
    const stmt = this.db.prepare("DELETE FROM journals where name = :name");
    // todo: validate exactly one was removed...
    stmt.run({ name: journal });

    // re-dindex
    // todo: transaction...
    await this.idxService.deindex(journal);

    this.journals = this.journals.filter((j) => j.name !== journal);
    return this.journals;
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
