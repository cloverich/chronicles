import fs from "fs";
import { Knex } from "knex";
import path from "path";
import { walk } from "../utils/fs-utils";
import { IDocumentsClient } from "./documents";
import { IFilesClient } from "./files";
import { IJournalsClient } from "./journals";
import { IPreferencesClient } from "./preferences";
import { SKIPPABLE_FILES, SKIPPABLE_PREFIXES } from "./types";
import { checkId } from "./util";

export type ISyncClient = SyncClient;

// Indicates which files to index when syncing
const shouldIndex = (dirent: fs.Dirent) => {
  for (const prefix of SKIPPABLE_PREFIXES) {
    if (dirent.name.startsWith(prefix)) return false;
  }

  if (SKIPPABLE_FILES.has(dirent.name)) return false;

  if (dirent.isFile()) {
    // for files, only index markdown files, unlike importer
    // which will import markdown and other files (if referenced)
    return dirent.name.endsWith(".md");
  } else {
    // at this point assume its a directory that likely has markdown files
    return true;
  }
};

export class SyncClient {
  constructor(
    private knex: Knex,
    private journals: IJournalsClient,
    private documents: IDocumentsClient,
    private files: IFilesClient,
    private preferences: IPreferencesClient,
  ) {}

  /**
   * Check if a sync is needed based on the last sync time
   *
   * note: extremely naive; revisit in https://github.com/cloverich/chronicles/issues/282
   * @returns true if a sync is needed
   */
  needsSync = async () => {
    const lastSync = await this.knex("sync").orderBy("id", "desc").first();
    if (lastSync?.completedAt) {
      const lastSyncDate = new Date(lastSync.completedAt);
      const now = new Date();
      const diff = now.getTime() - lastSyncDate.getTime();
      const diffHours = Math.trunc(diff / (1000 * 60 * 60));
      console.log(`last sync was ${diffHours} hours ago`);

      if (diffHours < 1) {
        console.log("skipping sync; last sync was less than an hour ago");
        return false;
      }
    }

    return true;
  };

  /**
   * Sync the notes directory with the database.
   * Uses incremental sync when possible - only processes changed files.
   */
  sync = async (force = false) => {
    if (!force && !(await this.needsSync())) return;

    const id = (await this.knex("sync").returning("id").insert({}))[0];
    const start = performance.now();

    const rootDir = await this.preferences.get("notesDir");

    if (!rootDir || typeof rootDir !== "string") {
      throw new Error("No chronicles root directory set");
    }

    await this.files.ensureDir(rootDir);
    await this.files.ensureDir(path.join(rootDir, "_attachments"));

    console.log("syncing directory", rootDir);

    // Pre-fetch all sync metadata for O(1) lookups during walk
    const allSyncMeta = await this.documents.getAllDocSyncMeta();

    // Pre-load existing journals to avoid duplicate inserts
    const journals = await this.initJournalsCounter();

    // Track documents seen on disk
    const seenDocumentIds = new Set<string>();
    const erroredDocumentPaths: string[] = [];

    let syncedCount = 0;
    let skippedCount = 0;

    for await (const file of walk(rootDir, 1, shouldIndex)) {
      const { name, dir } = path.parse(file.path);
      // filename is id; ensure it is formatted correctly
      const documentId = name;

      try {
        checkId(documentId);
      } catch (e) {
        console.error(
          "Invalid document id in sync; skipping",
          file.path,
          documentId,
          e,
        );
        continue;
      }

      // Track that we've seen this document on disk
      seenDocumentIds.add(documentId);

      // treated as journal name
      // NOTE: This directory check only works because we limit depth to 1
      const dirname = path.basename(dir);

      // Once we find at least one markdown file, we treat this directory
      // as a journal. Only index if it's a new journal.
      if (!(dirname in journals)) {
        // probably unnecessary
        await this.files.ensureDir(dir, false);
        await this.journals.index(dirname);
        journals[dirname] = 0;
      }

      // Get existing sync metadata from pre-fetched map
      const existingMeta = allSyncMeta.get(documentId);
      const fileMtime = Math.floor(file.stats.mtimeMs);
      const fileSize = file.stats.size;

      // FAST PATH: mtime + size match → skip entirely (no read, no parse)
      if (
        existingMeta?.mtime === fileMtime &&
        existingMeta?.size === fileSize
      ) {
        skippedCount++;
        continue;
      }

      // Read file + compute hash (cheap)
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
          journal: dirname, // using name as id
          mdast,
          frontMatter,
          rootDir,
          syncMeta: {
            mtime: fileMtime,
            size: fileSize,
            contentHash,
          },
        });
        syncedCount++;
      } catch (e) {
        erroredDocumentPaths.push(file.path);

        // https://github.com/cloverich/chronicles/issues/248
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
    const deletedCount =
      await this.documents.deleteOrphanedDocuments(seenDocumentIds);
    if (deletedCount > 0) {
      console.log(`Deleted ${deletedCount} orphaned documents from index`);
    }

    // Clean up orphaned journals (journals with no documents)
    await this.cleanupOrphanedJournals(journals);

    // Ensure default journal exists; attempt to declare one. Otherwise,
    // new documents will default to a journal that does not exist, and fail
    // to create.
    const defaultJournal = await this.preferences.get("defaultJournal");

    if (!defaultJournal || !(defaultJournal in journals)) {
      console.log("updating default journal", defaultJournal, journals);

      if (Object.keys(journals).length) {
        await this.preferences.set("defaultJournal", Object.keys(journals)[0]);
      } else {
        await this.journals.create({ name: "default_journal" });
        await this.preferences.set("defaultJournal", "default_journal");
      }
    }

    // remove any invalid archived journals
    const archivedJournals = await this.preferences.get("archivedJournals");
    for (const journal of Object.keys(archivedJournals)) {
      if (!(journal in journals)) {
        delete archivedJournals[journal];
      }
    }

    // ensure all existing journals are in the archived journals
    for (const journal of Object.keys(journals)) {
      if (!(journal in archivedJournals)) {
        archivedJournals[journal] = false;
      }
    }

    await this.preferences.set("archivedJournals", archivedJournals);

    const end = performance.now();
    const durationMs = (end - start).toFixed(2);
    await this.knex("sync").where("id", id).update({
      completedAt: new Date().toISOString(),
      errorCount: erroredDocumentPaths.length,
      syncedCount,
      durationMs,
    });
    console.log(
      `Sync complete: ${syncedCount} indexed, ${skippedCount} skipped (unchanged), ${deletedCount} deleted, ${erroredDocumentPaths.length} errors`,
    );
    if (erroredDocumentPaths.length > 0) {
      console.log("Errored documents (during sync)", erroredDocumentPaths);
    }
  };

  private initJournalsCounter = async (): Promise<Record<string, number>> => {
    const existingJournals = await this.knex("journals").select("name");
    const journals: Record<string, number> = {};
    for (const { name } of existingJournals) {
      journals[name] = 0;
    }
    return journals;
  };

  /**
   * Remove journals from the database that have no documents on disk.
   */
  private cleanupOrphanedJournals = async (
    journalsOnDisk: Record<string, number>,
  ) => {
    const dbJournals = await this.knex("journals").select("name");
    for (const { name } of dbJournals) {
      if (!(name in journalsOnDisk)) {
        await this.knex("journals").where({ name }).del();
        console.log(`Deleted orphaned journal: ${name}`);
      }
    }
  };
}
