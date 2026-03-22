import { desc, eq, isNotNull } from "drizzle-orm";
import { type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import path from "path";
import { SKIPPABLE_FILES, SKIPPABLE_PREFIXES } from "../preload/client/types";
import { checkId } from "../preload/client/util";
import { walk } from "../preload/utils/fs-utils";
import type { DocumentsClient } from "./documents";
import type { NodeFilesClient } from "./files";
import type { JournalsClient } from "./journals";
import type { PreferencesClient } from "./preferences";
import * as schema from "./schema";
import { sync } from "./schema";

export type IIndexerClient = IndexerClient;

/** Determines which filesystem entries to index */
const shouldIndex = (dirent: fs.Dirent) => {
  for (const prefix of SKIPPABLE_PREFIXES) {
    if (dirent.name.startsWith(prefix)) return false;
  }

  if (SKIPPABLE_FILES.has(dirent.name)) return false;

  if (dirent.isFile()) {
    return dirent.name.endsWith(".md");
  } else {
    return true;
  }
};

export class IndexerClient {
  constructor(
    private db: BetterSQLite3Database<typeof schema>,
    private journals: JournalsClient,
    private documents: DocumentsClient,
    private files: NodeFilesClient,
    private preferences: PreferencesClient,
  ) {}

  /**
   * Check if a full re-index is needed based on the last index time.
   * Returns true if > 1 month since last index.
   */
  needsFullReindex = async (): Promise<boolean> => {
    const [lastIndex] = await this.db
      .select()
      .from(sync)
      .where(isNotNull(sync.completedAt))
      .orderBy(desc(sync.id))
      .limit(1);

    if (!lastIndex) return true;

    const lastIndexDate = new Date(lastIndex.completedAt!);
    const diffDays = Math.trunc(
      (Date.now() - lastIndexDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    return diffDays >= 30;
  };

  /**
   * Index the notes directory into the database.
   * Uses incremental indexing when possible — only processes changed files.
   *
   * @param fullReindex - If true, skip mtime/hash optimizations and re-parse all documents.
   */
  index = async (fullReindex = false): Promise<void> => {
    const [{ id: syncId }] = await this.db
      .insert(sync)
      .values({})
      .returning({ id: sync.id });
    const start = performance.now();

    const rootDir = await this.preferences.get("notesDir");
    if (!rootDir || typeof rootDir !== "string") {
      throw new Error("No chronicles root directory set");
    }

    await this.files.ensureDir(rootDir);
    await this.files.ensureDir(path.join(rootDir, "_attachments"));

    const needsFull = fullReindex || (await this.needsFullReindex());

    // Pre-fetch all sync metadata for O(1) lookups during walk
    const allSyncMeta = needsFull
      ? new Map()
      : await this.documents.getAllDocSyncMeta();

    // Pre-load existing DB journals so we skip duplicate create calls,
    // but track journalsOnDisk separately (only journals with files on disk).
    const knownJournals = await this.initJournalsCounter();
    const journalsOnDisk: Record<string, number> = {};

    const seenDocumentIds = new Set<string>();
    const erroredDocumentPaths: string[] = [];

    let indexedCount = 0;
    let skippedCount = 0;

    for await (const file of walk(rootDir, 1, shouldIndex)) {
      const { name, dir } = path.parse(file.path);
      const documentId = name;

      try {
        checkId(documentId);
      } catch {
        continue;
      }

      seenDocumentIds.add(documentId);

      const dirname = path.basename(dir);

      // Track journal as seen on disk; create in DB if unknown
      if (!(dirname in journalsOnDisk)) {
        journalsOnDisk[dirname] = 0;
        if (!(dirname in knownJournals)) {
          await this.files.ensureDir(dir, false);
          await this.journals.index(dirname);
        }
      }

      const existingMeta = allSyncMeta.get(documentId);
      const fileMtime = Math.floor(file.stats.mtimeMs);
      const fileSize = file.stats.size;

      // FAST PATH: mtime + size match → skip entirely
      if (
        existingMeta?.mtime === fileMtime &&
        existingMeta?.size === fileSize
      ) {
        skippedCount++;
        continue;
      }

      // Read file + compute hash
      const { rawContents, contentHash } = await this.documents.readDocRaw(
        file.path,
      );

      // MEDIUM PATH: hash matches → update meta only, skip parse
      if (existingMeta?.contentHash === contentHash) {
        await this.documents.updateDocSyncMeta(documentId, {
          mtime: fileMtime,
          size: fileSize,
        });
        skippedCount++;
        continue;
      }

      // SLOW PATH: content changed → parse and reindex
      const { mdast, frontMatter } = this.documents.parseDoc(
        rawContents,
        file.stats,
      );

      try {
        await this.documents.createIndex({
          id: documentId,
          journal: dirname,
          mdast,
          frontMatter,
          rootDir,
          syncMeta: {
            mtime: fileMtime,
            size: fileSize,
            contentHash,
          },
        });
        indexedCount++;
      } catch (e) {
        erroredDocumentPaths.push(file.path);
        console.error(
          "Error with document",
          documentId,
          "for journal",
          dirname,
          e,
        );
      }
    }

    // Delete documents that no longer exist on disk
    await this.documents.deleteOrphanedDocuments(seenDocumentIds);

    // Clean up orphaned journals
    await this.cleanupOrphanedJournals(journalsOnDisk);

    // Ensure default journal exists
    const defaultJournal = await this.preferences.get("defaultJournal");
    if (!defaultJournal || !(defaultJournal in journalsOnDisk)) {
      if (Object.keys(journalsOnDisk).length) {
        await this.preferences.set(
          "defaultJournal",
          Object.keys(journalsOnDisk)[0],
        );
      } else {
        await this.journals.create({ name: "default_journal" });
        await this.preferences.set("defaultJournal", "default_journal");
      }
    }

    // Sync archived journals state
    const archivedJournals =
      (await this.preferences.get("archivedJournals")) || {};
    for (const journal of Object.keys(archivedJournals)) {
      if (!(journal in journalsOnDisk)) {
        delete archivedJournals[journal];
      }
    }
    for (const journal of Object.keys(journalsOnDisk)) {
      if (!(journal in archivedJournals)) {
        archivedJournals[journal] = false;
      }
    }
    await this.preferences.set("archivedJournals", archivedJournals);

    const durationMs = Math.round(performance.now() - start);
    await this.db
      .update(sync)
      .set({
        completedAt: new Date().toISOString(),
        errorCount: erroredDocumentPaths.length,
        syncedCount: indexedCount,
        durationMs,
      })
      .where(eq(sync.id, syncId));
  };

  private initJournalsCounter = async (): Promise<Record<string, number>> => {
    const rows = await this.journals.list();
    const counter: Record<string, number> = {};
    for (const j of rows) {
      counter[j.name] = 0;
    }
    return counter;
  };

  private cleanupOrphanedJournals = async (
    journalsOnDisk: Record<string, number>,
  ) => {
    const dbJournals = await this.journals.list();
    for (const { name } of dbJournals) {
      if (!(name in journalsOnDisk)) {
        await this.journals.remove(name);
      }
    }
  };
}
