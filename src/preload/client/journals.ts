import { Database } from "better-sqlite3";
import path from "path";

import { IFilesClient } from "./files";
import { IPreferencesClient } from "./preferences";
import { JournalResponse } from "./types";

export type IJournalsClient = JournalsClient;

export class JournalsClient {
  constructor(
    private db: Database,
    private files: IFilesClient,
    private preferences: IPreferencesClient,
  ) {}

  list = async (): Promise<JournalResponse[]> => {
    const journals = this.db
      .prepare("select * from journals order by name")
      .all();

    const archived = await this.preferences.get("ARCHIVED_JOURNALS");
    journals.forEach((j) => {
      j.archived = archived[j.name];
    });

    return journals;
  };

  create = async (journal: { name: string }): Promise<JournalResponse> => {
    const name = validateJournalName(journal.name);
    await this.files.createFolder(name);
    return this.index(name);
  };

  index = async (journalName: string): Promise<JournalResponse> => {
    // add to archived if not already present
    const existing = await this.preferences.get(
      `ARCHIVED_JOURNALS.${journalName}`,
    );
    if (existing == null) {
      await this.preferences.set(`ARCHIVED_JOURNALS.${journalName}`, false);
    }

    this.db
      .prepare(
        "insert into journals (name, createdAt, updatedAt) values (:name, :createdAt, :updatedAt)",
      )
      .run({
        name: journalName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

    return this.db
      .prepare("select * from journals where name = :name")
      .get({ name: journalName });
  };

  rename = async (
    // note: do not pass the full JournalResponse mobx object here; restructure
    // it to just the name and archived fields
    journal: { name: string; archived: boolean },
    newName: string,
  ): Promise<JournalResponse> => {
    newName = validateJournalName(newName);
    await this.files.renameFolder(journal.name, newName);

    this.db
      .prepare(
        "update journals set name = :newName, updatedAt = :updatedAt where name = :name",
      )
      .run({
        name: journal.name,
        newName,
        updatedAt: new Date().toISOString(),
      });

    // todo: dumb; revert to having documents reference id instead of name
    this.db
      .prepare("update documents set journal = :newName where journal = :name")
      .run({
        name: journal.name,
        newName,
      });

    await this.preferences.delete(`ARCHIVED_JOURNALS.${journal.name}`);
    await this.preferences.set(
      `ARCHIVED_JOURNALS.${newName}`,
      journal.archived,
    );

    return this.db
      .prepare("select * from journals where name = :name")
      .get({ name: newName });
  };

  remove = async (journal: string): Promise<JournalResponse[]> => {
    // todo: Allow removing the last journal; handle this like first-time
    // setup
    if ((await this.list()).length === 1) {
      throw new Error(
        "Cannot delete the last journal. Create a new journal first.",
      );
    }

    await this.files.removeFolder(journal);
    await this.preferences.delete(`ARCHIVED_JOURNALS.${journal}`);

    this.db
      .prepare("delete from journals where name = :name")
      .run({ name: journal });
    return this.list();
  };

  archive = async (journal: string): Promise<JournalResponse[]> => {
    await this.preferences.set(`ARCHIVED_JOURNALS.${journal}`, true);
    return this.list();
  };

  unarchive = async (journal: string): Promise<JournalResponse[]> => {
    await this.preferences.set(`ARCHIVED_JOURNALS.${journal}`, false);
    return this.list();
  };
}

const MAX_NAME_LENGTH = 25;

/**
 * A basic validation function for journal names.
 */
export const validateJournalName = (name: string): string => {
  name = name?.trim() || "";
  if (!name) {
    throw new Error("Journal name cannot be empty.");
  }

  if (name === "_attachments") {
    throw new Error("Journal name cannot be '_attachments'.");
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
