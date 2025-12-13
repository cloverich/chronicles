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

    const archived = await this.preferences.get("archivedJournals");
    for (const j of journals) {
      if (!(j.name in archived)) {
        console.warn(
          "journal",
          j.name,
          "not found in archived when listing journals. Patching, but this is likely a bug.",
        );
        j.archived = false;
        await this.preferences.set("archivedJournals." + j.name, false);
      } else {
        j.archived = archived[j.name] || false;
      }
    }

    return journals;
  };

  create = async (journal: { name: string }): Promise<JournalResponse> => {
    const name = validateJournalName(journal.name);
    await this.files.createFolder(name);
    return this.index(name);
  };

  index = async (journalName: string): Promise<JournalResponse> => {
    // index called on initial create, and when syncing (re-building the index)
    // so we need to sync prior archived state, if present.
    // todo: journal.archived state management is shit. Improve it.
    const archived = await this.preferences.get(`archivedJournals`);
    const existing = journalName in archived;
    let isArchived: boolean;

    if (!existing) {
      await this.preferences.set(`archivedJournals.${journalName}`, false);
      isArchived = false;
    } else {
      isArchived = archived[journalName];
    }

    const timestamp = new Date().toISOString();

    await this.knex("journals")
      .insert({
        name: journalName,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .onConflict("name")
      .ignore();

    const journal = await this.knex("journals")
      .where("name", journalName)
      .first();
    journal.archived = isArchived;
    return journal;
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

    await this.preferences.delete(`archivedJournals.${journal.name}`);

    if (journal.archived == null) {
      console.warn(
        "journal.archived is null, defaulting to false. This is likely a bug.",
      );
      journal.archived = false;
    }

    await this.preferences.set(`archivedJournals.${newName}`, journal.archived);

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
    await this.preferences.delete(`archivedJournals.${journal}`);

    await this.knex("journals").where("name", journal).delete();
    return this.list();
  };

  archive = async (journal: string): Promise<JournalResponse[]> => {
    if ((await this.list()).length === 1) {
      throw new Error(
        "Cannot archive the last journal. Create a new journal first.",
      );
    }
    await this.preferences.set(`archivedJournals.${journal}`, true);
    return this.list();
  };

  unarchive = async (journal: string): Promise<JournalResponse[]> => {
    await this.preferences.set(`archivedJournals.${journal}`, false);
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
