import { eq } from "drizzle-orm";
import { type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import path from "path";

import type { IPreferencesClient } from "./preferences";
import type { IJournalFolderOps } from "./files";
import * as schema from "./schema";
import { journals as journalsTable, documents as documentsTable } from "./schema";

export type JournalResponse = {
  name: string;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
};

export interface JournalWithCount extends JournalResponse {
  count: number;
}

export type IJournalsClient = JournalsClient;

export class JournalsClient {
  constructor(
    private db: BunSQLiteDatabase<typeof schema>,
    private files: IJournalFolderOps,
    private preferences: IPreferencesClient,
  ) {}

  list = async (): Promise<JournalResponse[]> => {
    const rows = await this.db
      .select()
      .from(journalsTable)
      .orderBy(journalsTable.name);

    const archived: Record<string, boolean> =
      (await this.preferences.get("archivedJournals")) ?? {};

    const results: JournalResponse[] = [];
    for (const j of rows) {
      if (!(j.name in archived)) {
        // patch missing entry
        await this.preferences.set(`archivedJournals.${j.name}`, false);
        archived[j.name] = false;
      }
      results.push({
        name: j.name,
        createdAt: j.createdAt,
        updatedAt: j.updatedAt,
        archived: archived[j.name] || false,
      });
    }

    return results;
  };

  listWithCounts = async (): Promise<JournalWithCount[]> => {
    const journals = await this.list();

    // Count documents per journal
    const countRows = await this.db
      .select({ journal: documentsTable.journal })
      .from(documentsTable);

    const countMap = new Map<string, number>();
    for (const row of countRows) {
      countMap.set(row.journal, (countMap.get(row.journal) ?? 0) + 1);
    }

    return journals.map((j) => ({
      ...j,
      count: countMap.get(j.name) ?? 0,
    }));
  };

  create = async (journal: { name: string }): Promise<JournalResponse> => {
    const name = validateJournalName(journal.name);
    await this.files.createFolder(name);
    return this.index(name);
  };

  index = async (journalName: string): Promise<JournalResponse> => {
    const archivedPrefs: Record<string, boolean> =
      (await this.preferences.get("archivedJournals")) ?? {};

    let isArchived: boolean;
    if (!(journalName in archivedPrefs)) {
      await this.preferences.set(`archivedJournals.${journalName}`, false);
      isArchived = false;
    } else {
      isArchived = archivedPrefs[journalName];
    }

    const timestamp = new Date().toISOString();

    await this.db.insert(journalsTable).values({
      name: journalName,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const [row] = await this.db
      .select()
      .from(journalsTable)
      .where(eq(journalsTable.name, journalName));

    return { ...row, archived: isArchived };
  };

  rename = async (
    journal: { name: string; archived: boolean },
    newName: string,
  ): Promise<JournalResponse> => {
    newName = validateJournalName(newName);
    await this.files.renameFolder(journal.name, newName);

    const timestamp = new Date().toISOString();

    await this.db
      .update(journalsTable)
      .set({ name: newName, updatedAt: timestamp })
      .where(eq(journalsTable.name, journal.name));

    // documents.journal is updated by ON UPDATE CASCADE (FK constraint)

    await this.preferences.delete(`archivedJournals.${journal.name}`);
    await this.preferences.set(
      `archivedJournals.${newName}`,
      journal.archived ?? false,
    );

    const [row] = await this.db
      .select()
      .from(journalsTable)
      .where(eq(journalsTable.name, newName));

    return { ...row, archived: journal.archived ?? false };
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
    await this.db
      .delete(journalsTable)
      .where(eq(journalsTable.name, journal));

    return this.list();
  };

  archive = async (journal: string): Promise<JournalResponse[]> => {
    const journals = await this.list();
    if (journals.length === 1) {
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

export const validateJournalName = (name: string): string => {
  name = name?.trim() || "";
  if (!name) {
    throw new Error("Journal name cannot be empty.");
  }

  if (name === "_attachments") {
    throw new Error("Journal name cannot be '_attachments'.");
  }

  if (name.length > MAX_NAME_LENGTH) {
    throw new Error(
      `Journal name exceeds max length of ${MAX_NAME_LENGTH} characters.`,
    );
  }

  const sanitized = decodeURIComponent(encodeURIComponent(name));
  if (name !== sanitized) {
    throw new Error("Journal name is not URL safe.");
  }

  const baseSanitized = path.basename(name);
  if (baseSanitized !== name) {
    throw new Error("Journal name contains invalid path characters.");
  }

  return baseSanitized;
};
