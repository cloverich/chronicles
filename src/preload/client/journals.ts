import { Knex } from "knex";
import path from "path";

import { IFilesClient } from "./files";
import { IPreferencesClient } from "./preferences";
import { JournalResponse } from "./types";

export type IJournalsClient = JournalsClient;

export class JournalsClient {
  constructor(
    private knex: Knex,
    private files: IFilesClient,
    private preferences: IPreferencesClient,
  ) {}

  list = async (): Promise<JournalResponse[]> => {
    const journals = await this.knex("journals").select("*").orderBy("name");

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
    const existing = await this.preferences.get(
      `ARCHIVED_JOURNALS.${journalName}`,
    );

    if (existing == null) {
      await this.preferences.set(`ARCHIVED_JOURNALS.${journalName}`, false);
    }

    const timestamp = new Date().toISOString();

    await this.knex("journals").insert({
      name: journalName,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return await this.knex("journals").where("name", journalName).first();
  };

  rename = async (
    journal: { name: string; archived: boolean },
    newName: string,
  ): Promise<JournalResponse> => {
    newName = validateJournalName(newName);
    await this.files.renameFolder(journal.name, newName);

    const timestamp = new Date().toISOString();

    await this.knex("journals")
      .update({ name: newName, updatedAt: timestamp })
      .where("name", journal.name);

    await this.knex("documents")
      .update({ journal: newName })
      .where("journal", journal.name);

    await this.preferences.delete(`ARCHIVED_JOURNALS.${journal.name}`);
    await this.preferences.set(
      `ARCHIVED_JOURNALS.${newName}`,
      journal.archived,
    );

    return await this.knex("journals").where("name", newName).first();
  };

  remove = async (journal: string): Promise<JournalResponse[]> => {
    const journals = await this.list();
    if (journals.length === 1) {
      throw new Error(
        "Cannot delete the last journal. Create a new journal first.",
      );
    }

    await this.files.removeFolder(journal);
    await this.preferences.delete(`ARCHIVED_JOURNALS.${journal}`);

    await this.knex("journals").where("name", journal).delete();
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

export const MAX_NAME_LENGTH = 25;

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

  // Ensure journal name is not too long
  if (name.length > MAX_NAME_LENGTH) {
    throw new Error(
      `Journal name exceeds max length of ${MAX_NAME_LENGTH} characters.`,
    );
  }

  let sanitized = decodeURIComponent(encodeURIComponent(name));

  // Check for URL safe characters
  if (name !== sanitized) {
    throw new Error("Journal name is not URL safe.");
  }

  // Ensure the name does not contain path traversal characters or invalid slashes
  sanitized = path.basename(name);
  if (sanitized !== name) {
    throw new Error("Journal name contains invalid path characters.");
  }

  return sanitized;
};
