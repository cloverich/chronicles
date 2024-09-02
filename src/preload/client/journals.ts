import { Database } from "better-sqlite3";
import { uuidv7 } from "uuidv7";

export interface JournalResponse {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string;
}

export type IJournalsClient = JournalsClient;

export class JournalsClient {
  constructor(private db: Database) {}

  list = async (): Promise<JournalResponse[]> => {
    return this.db.prepare("select * from journals order by name").all();
  };

  create = (journal: { name: string }): Promise<JournalResponse> => {
    const id = uuidv7();

    this.db
      .prepare(
        "insert into journals (id, name, createdAt, updatedAt) values (:id, :name, :createdAt, :updatedAt)",
      )
      .run({
        name: journal.name,
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

    return this.db.prepare("select * from journals where id = :id").get({ id });
  };

  update = (journal: {
    id: string;
    name: string;
  }): Promise<JournalResponse> => {
    if (!journal.name?.trim()) throw new Error("Journal name cannot be empty");

    this.db
      .prepare(
        "update journals set name = :name, updatedAt = :updatedAt where id = :id",
      )
      .run({
        name: journal.name,
        id: journal.id,
        updatedAt: new Date().toISOString(),
      });

    return this.db
      .prepare("select * from journals where id = :id")
      .get({ id: journal.id });
  };

  remove = (journal: { id: string }): Promise<JournalResponse[]> => {
    // TODO: ensure there is always at least one journal. Deleting the last journal breaks the app.
    this.db
      .prepare("delete from journals where id = :id")
      .run({ id: journal.id });
    return this.list();
  };

  archive = (journal: { id: string }): Promise<JournalResponse[]> => {
    this.db
      .prepare("update journals set archivedAt = :archivedAt where id = :id")
      .run({
        id: journal.id,
        archivedAt: new Date().toISOString(),
      });

    return this.list();
  };

  unarchive = (journal: { id: string }): Promise<JournalResponse[]> => {
    this.db
      .prepare("update journals set archivedAt = null where id = :id")
      .run({
        id: journal.id,
      });

    return this.list();
  };
}
