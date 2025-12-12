import fs from "fs";
import crypto from "crypto";
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
   * Sync the notes directory with the database
   */
  sync = async (force = false) => {
    if (!force && !this.needsSync()) return;

    const id = (await this.knex("sync").returning("id").insert({}))[0];
    const start = performance.now();

    // We use upsert/incremental sync now, so do not wipe tables.
    // https://github.com/cloverich/chronicles/issues/282

    const rootDir = await this.preferences.get("notesDir");

    if (!rootDir || typeof rootDir !== "string") {
      throw new Error("No chronicles root directory set");
    }

    await this.files.ensureDir(rootDir);
    await this.files.ensureDir(path.join(rootDir, "_attachments"));

    console.log("syncing directory", rootDir);

    // Track created journals and number of documents to help troubleshoot
    // sync issues
    const journals: Record<string, number> = {};
    const journalPromises = new Map<string, Promise<void>>();
    const erroredDocumentPaths: string[] = [];

    let syncedCount = 0;
    let skippedCount = 0;

    // Incremental sync: determine cutoff time
    // If force=true, we ignore last sync time and re-process all files.
    let lastSyncTime = 0;
    if (!force) {
      const lastSync = await this.knex("sync")
        .whereNotNull("completedAt")
        .orderBy("id", "desc")
        .first();
      if (lastSync) {
        lastSyncTime = new Date(lastSync.startedAt).getTime();
      }
    }

    // Get existing metadata for hash checking
    const existingDocs = new Map<
      string,
      {
        fileSize: number | null;
        fileMtime: number | null;
        contentHash: string | null;
      }
    >();
    const docs = await this.knex("documents").select(
      "id",
      "fileSize",
      "fileMtime",
      "contentHash",
    );
    for (const doc of docs) {
      existingDocs.set(doc.id, {
        fileSize: doc.fileSize,
        fileMtime: doc.fileMtime,
        contentHash: doc.contentHash,
      });
    }

    const seenIds = new Set<string>();
    const pool = new Set<Promise<void>>();
    const CONCURRENCY = 50;

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

      // treated as journal name
      // NOTE: This directory check only works because we limit depth to 1
      const dirname = path.basename(dir);

      // Ensure journal exists (memoized promise to handle concurrency)
      if (!journalPromises.has(dirname)) {
        journalPromises.set(
          dirname,
          (async () => {
            // probably unnecessary
            await this.files.ensureDir(dir, false);
            await this.journals.index(dirname);
          })(),
        );
        journals[dirname] = 0;
      }

      seenIds.add(documentId);

      // Smart Sync Heuristics
      const docMeta = existingDocs.get(documentId);
      const currentMtime = file.stats.mtime.getTime();
      const currentSize = file.stats.size;

      // 1. Fast Check: mtime and size match
      if (
        !force &&
        docMeta &&
        docMeta.fileMtime === currentMtime &&
        docMeta.fileSize === currentSize
      ) {
        skippedCount++;
        continue;
      }

      // Worker function
      const processFile = async () => {
        try {
          // Wait for journal to be ready (FK constraint)
          await journalPromises.get(dirname);

          // 2. Hash Check: Read file and hash
          const { contents, frontMatter, mdast } =
            await this.documents.loadDoc(file.path);
          const contentHash = crypto
            .createHash("sha1")
            .update(contents)
            .digest("hex");

          // If hash matches, update metadata but skip indexing
          if (
            !force &&
            docMeta &&
            docMeta.contentHash === contentHash
          ) {
            // Update mtime/size in DB to match current file, so next sync hits fast path
            await this.knex("documents")
              .where({ id: documentId })
              .update({
                fileSize: currentSize,
                fileMtime: currentMtime,
              });
            skippedCount++;
            return;
          }

          await this.documents.upsertIndex({
            id: documentId,
            journal: dirname, // using name as id
            content: contents,
            frontMatter,
            rootDir,
            mdast,
            contentHash,
            fileSize: currentSize,
            fileMtime: currentMtime,
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
      };

      // Add to pool
      const p = processFile().then(() => {
        pool.delete(p);
      });
      pool.add(p);

      if (pool.size >= CONCURRENCY) {
        await Promise.race(pool);
      }
    }

    // Await remaining tasks
    await Promise.all(pool);

    // Delete documents that were not seen on filesystem
    // We get all IDs from DB first
    // Note: We already fetched all IDs above into `docs`, but that was snapshot at start.
    // Is it possible docs were added/removed during sync? Unlikely from other sources.
    // Use existingDocs map keys as the set of known IDs at start.
    // However, we only care about deleting IDs that are in DB but not in seenIds.
    // Using `existingDocs` keys is safe enough.
    const toDelete = Array.from(existingDocs.keys()).filter(
      (id) => !seenIds.has(id),
    );

    if (toDelete.length > 0) {
      console.log(`Deleting ${toDelete.length} stale documents`);
      // Batch delete could be better but simple loop is fine for now given local DB
      // Actually knex .whereIn is better
      // Chunk it just in case of huge lists
      const CHUNK_SIZE = 999;
      for (let i = 0; i < toDelete.length; i += CHUNK_SIZE) {
        const chunk = toDelete.slice(i, i + CHUNK_SIZE);
        await this.knex("documents").whereIn("id", chunk).del();
        // Cascades will handle tags/links
      }
    }

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
    console.log("Errored documents (during sync)", erroredDocumentPaths);
  };
}
