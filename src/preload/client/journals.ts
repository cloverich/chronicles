import { Database } from "better-sqlite3";
import path from "path";
import { uuidv7 } from "uuidv7";

import { JournalResponse } from "./types";

export type IJournalsClient = JournalsClient;

export class JournalsClient {
  constructor(private db: Database) {}

  list = async (): Promise<JournalResponse[]> => {
    return this.db.prepare("select * from journals order by name").all();
  };

  create = (journal: { name: string }): Promise<JournalResponse> => {
    const name = validateJournalName(journal.name);
    const id = uuidv7();

    this.db
      .prepare(
        "insert into journals (id, name, createdAt, updatedAt) values (:id, :name, :createdAt, :updatedAt)",
      )
      .run({
        id,
        name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

    return this.db.prepare("select * from journals where id = :id").get({ id });
  };

  update = (journal: {
    id: string;
    name: string;
  }): Promise<JournalResponse> => {
    const name = validateJournalName(journal.name);

    this.db
      .prepare(
        "update journals set name = :name, updatedAt = :updatedAt where id = :id",
      )
      .run({
        name,
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

const MAX_NAME_LENGTH = 20;

/**
 * A basic validation function for journal names.
 */
const validateJournalName = (name: string): string => {
  name = name?.trim() || "";
  if (!name) {
    throw new Error("Journal name cannot be empty.");
  }

  // Check for max length
  if (name.length > MAX_NAME_LENGTH) {
    throw new Error(
      `Journal name exceeds max length of ${MAX_NAME_LENGTH} characters.`,
    );
  }

  let sanitized = decodeURIComponent(encodeURIComponent(name));

  // Check for URL safety
  if (name !== sanitized) {
    throw new Error("Journal name is not URL safe.");
  }

  // Ensure the name doesn't contain path traversal or invalid slashes
  sanitized = path.basename(name);
  if (sanitized !== name) {
    throw new Error("Journal name contains invalid path characters.");
  }

  return sanitized;
};
