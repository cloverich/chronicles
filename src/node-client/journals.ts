import { and, eq, isNull, sql } from "drizzle-orm";
import { type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import path from "path";

import { createId } from "../preload/client/util";
import type { Trx } from "./derive";
import { tombstoneNotes } from "./documents";
import type { IPreferences, IPreferencesClient } from "./preferences";
import * as schema from "./schema";
import {
  documents as documentsTable,
  journals as journalsTable,
} from "./schema";

export type JournalResponse = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
};

export interface JournalWithCount extends JournalResponse {
  count: number;
}

export type IJournalsClient = JournalsClient;

const toResponse = (
  row: typeof journalsTable.$inferSelect,
): JournalResponse => ({
  id: row.id,
  name: row.name,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  archived: row.archivedAt != null,
});

export class JournalsClient {
  constructor(
    private db: BetterSQLite3Database<typeof schema>,
    private preferences: IPreferencesClient,
  ) {}

  list = async (): Promise<JournalResponse[]> => {
    const rows = await this.db
      .select()
      .from(journalsTable)
      .orderBy(journalsTable.name);

    return rows.map(toResponse);
  };

  listWithCounts = async (): Promise<JournalWithCount[]> => {
    const journals = await this.list();

    const countRows = await this.db
      .select({
        journalId: documentsTable.journalId,
        count: sql<number>`count(*)`,
      })
      .from(documentsTable)
      .groupBy(documentsTable.journalId);
    const countMap = new Map(countRows.map((r) => [r.journalId, r.count]));

    return journals.map((j) => ({
      ...j,
      count: countMap.get(j.id) ?? 0,
    }));
  };

  create = async (journal: { name: string }): Promise<JournalResponse> => {
    const name = validateJournalName(journal.name);
    const existing = findJournalIgnoringCase(this.db, name);
    if (existing) {
      throw new Error(`Journal "${existing}" already exists.`);
    }
    return this.index(name);
  };

  index = async (
    journalName: string,
    id: string = createId(),
  ): Promise<JournalResponse> => {
    const timestamp = new Date().toISOString();

    await this.db.insert(journalsTable).values({
      id,
      name: journalName,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const [row] = await this.db
      .select()
      .from(journalsTable)
      .where(eq(journalsTable.name, journalName));

    return toResponse(row);
  };

  rename = async (
    journal: { name: string; archived: boolean },
    newName: string,
  ): Promise<JournalResponse> => {
    newName = validateJournalName(newName);

    // Allow re-casing the same journal (features → Features); reject collisions.
    const existing = findJournalIgnoringCase(this.db, newName);
    if (existing && existing !== journal.name) {
      throw new Error(`Journal "${existing}" already exists.`);
    }

    const timestamp = new Date().toISOString();

    await this.db
      .update(journalsTable)
      .set({ name: newName, updatedAt: timestamp })
      .where(eq(journalsTable.name, journal.name));

    // Documents reference the journal by id; nothing else changes.

    const [row] = await this.db
      .select()
      .from(journalsTable)
      .where(eq(journalsTable.name, newName));

    return toResponse(row);
  };

  remove = async (journal: string): Promise<JournalResponse[]> => {
    const journals = await this.list();
    if (journals.length === 1) {
      throw new Error(
        "Cannot delete the last journal. Create a new journal first.",
      );
    }

    this.db.transaction((trx) => {
      const [row] = trx
        .select({ id: journalsTable.id })
        .from(journalsTable)
        .where(eq(journalsTable.name, journal))
        .all();
      if (!row) return;

      const noteIds = trx
        .select({ id: documentsTable.id })
        .from(documentsTable)
        .where(eq(documentsTable.journalId, row.id))
        .all()
        .map((d) => d.id);
      tombstoneNotes(trx, noteIds);
      for (const id of noteIds) {
        trx.run(sql`DELETE FROM documents_fts WHERE id = ${id}`);
      }
      trx
        .delete(documentsTable)
        .where(eq(documentsTable.journalId, row.id))
        .run();
      trx.delete(journalsTable).where(eq(journalsTable.id, row.id)).run();
      trx
        .insert(schema.tombstones)
        .values({
          id: row.id,
          kind: "journal",
          deletedAt: new Date().toISOString(),
        })
        .onConflictDoNothing()
        .run();
    });
    return this.list();
  };

  archive = async (journal: string): Promise<JournalResponse[]> => {
    const journals = await this.list();
    if (journals.length === 1) {
      throw new Error(
        "Cannot archive the last journal. Create a new journal first.",
      );
    }
    await this.setArchived(journal, new Date().toISOString());
    return this.list();
  };

  unarchive = async (journal: string): Promise<JournalResponse[]> => {
    await this.setArchived(journal, null);
    return this.list();
  };

  private setArchived = async (journal: string, archivedAt: string | null) => {
    await this.db
      .update(journalsTable)
      .set({ archivedAt })
      .where(eq(journalsTable.name, journal));
  };

  /**
   * One-time move of archived state from the `archivedJournals` preference
   * (a name → boolean map) to `journals.archivedAt`. Deletes the preference
   * afterwards, so it runs once.
   */
  migrateArchivedPreference = async (): Promise<void> => {
    const archived: IPreferences["archivedJournals"] =
      await this.preferences.get("archivedJournals");
    if (!archived) return;
    const now = new Date().toISOString();
    for (const [name, isArchived] of Object.entries(archived)) {
      if (!isArchived) continue;
      await this.db
        .update(journalsTable)
        .set({ archivedAt: now })
        .where(
          and(eq(journalsTable.name, name), isNull(journalsTable.archivedAt)),
        );
    }
    await this.preferences.delete("archivedJournals");
  };

  /**
   * Ensures a usable default journal exists. Called once at startup
   * (see `createClient` in ./factory.ts):
   * - If no journals exist, creates `default_journal`.
   * - If the `defaultJournal` preference is unset or names a journal that
   *   no longer exists, resets it to the first journal (by name).
   */
  ensureDefault = async (): Promise<void> => {
    let journals = await this.list();

    if (journals.length === 0) {
      await this.create({ name: "default_journal" });
      journals = await this.list();
    }

    const defaultJournal = await this.preferences.get("defaultJournal");
    if (!defaultJournal || !journals.some((j) => j.name === defaultJournal)) {
      await this.preferences.set("defaultJournal", journals[0].name);
    }
  };
}

export const MAX_NAME_LENGTH = 25;

/**
 * Journal names are unique ignoring case. Returns the stored name matching
 * `name` case-insensitively, if any. Uses SQLite's lower(), which only folds
 * ASCII without ICU — non-ASCII names still compare byte-for-byte.
 */
export const findJournalIgnoringCase = (
  db: Trx,
  name: string,
): string | undefined => {
  const [row] = db
    .select({ name: journalsTable.name })
    .from(journalsTable)
    .where(sql`lower(${journalsTable.name}) = lower(${name})`)
    .all();
  return row?.name;
};

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

/** The id of the journal named exactly `name`; throws if none. */
export const resolveJournalId = (trx: Trx, name: string): string => {
  const [row] = trx
    .select({ id: journalsTable.id })
    .from(journalsTable)
    .where(eq(journalsTable.name, name))
    .all();
  if (!row) throw new Error(`[JOURNAL_NOT_FOUND] Journal ${name} not found`);
  return row.id;
};
