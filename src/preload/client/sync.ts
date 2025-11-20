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
   * Sync the notes directory with the database
   */
  sync = async (force = false) => {
    if (!force && !this.needsSync()) return;

    const id = (await this.knex("sync").returning("id").insert({}))[0];
    const start = performance.now();

    await this.knex("document_tags").delete();
    await this.knex("documents").delete();
    await this.knex("journals").delete();
    // image and note links delete via cascade

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
    const erroredDocumentPaths: string[] = [];

    let syncedCount = 0;

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

      // Once we find at least one markdown file, we treat this directory
      // as a journal
      if (!(dirname in journals)) {
        // probably unnecessary
        await this.files.ensureDir(dir, false);
        await this.journals.index(dirname);
        journals[dirname] = 0;
      }

      const { contents, frontMatter } = await this.documents.loadDoc(file.path);

      try {
        await this.documents.createIndex({
          id: documentId,
          journal: dirname, // using name as id
          content: contents,
          frontMatter,
          rootDir,
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
