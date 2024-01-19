import { uuidv7 } from "uuidv7";
import { Database } from "better-sqlite3";

interface IJournal {
  // path to root folder
  url: string;
  // display name
  name: string;

  /**
   * The duration of a single document in a journal.
   */
  period: "day" | "week" | "month" | "year";
}

export interface JournalResponse {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export type IJournalsClient = JournalsClient;

export class JournalsClient {
  constructor(private db: Database) {}

  list = async (): Promise<JournalResponse[]> => {
    return this.db.prepare("select * from journals").all();
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

  remove = (journal: { id: string }): Promise<JournalResponse[]> => {
    this.db
      .prepare("delete from journals where id = :id")
      .run({ id: journal.id });
    return this.list();
  };
}
