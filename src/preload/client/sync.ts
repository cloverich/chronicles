import { Database } from "better-sqlite3";
import fs from "fs";
import { Knex } from "knex";
import path from "path";
import { Files } from "../files";
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
    private db: Database,
    private knex: Knex,
    private journals: IJournalsClient,
    private documents: IDocumentsClient,
    private files: IFilesClient,
    private preferences: IPreferencesClient,
  ) {}

  /**
   * Sync the notes directory with the database
   */
  sync = async (force = false) => {
    // Skip sync if completed recently; not much thought put into this
    const lastSync = await this.knex("sync").orderBy("id", "desc").first();
    if (lastSync?.completedAt && !force) {
      const lastSyncDate = new Date(lastSync.completedAt);
      const now = new Date();
      const diff = now.getTime() - lastSyncDate.getTime();
      const diffHours = diff / (1000 * 60 * 60);
      console.log(`last sync was ${diffHours} ago`);
      if (diffHours < 1) {
        console.log("skipping sync; last sync was less than an hour ago");
        return;
      }
    }

    const id = (await this.knex("sync").returning("id").insert({}))[0];
    const start = performance.now();

    this.db.exec("delete from document_tags");
    this.db.exec("delete from documents");
    this.db.exec("delete from journals");

    const rootDir = await this.preferences.get("NOTES_DIR");

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

    for await (const file of Files.walk(rootDir, 1, shouldIndex)) {
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
    const defaultJournal = await this.preferences.get("DEFAULT_JOURNAL");

    if (!defaultJournal || !(defaultJournal in journals)) {
      console.log("updating default journal", defaultJournal, journals);

      if (Object.keys(journals).length) {
        await this.preferences.set("DEFAULT_JOURNAL", Object.keys(journals)[0]);
      } else {
        await this.journals.create({ name: "default_journal" });
        await this.preferences.set("DEFAULT_JOURNAL", "default_journal");
      }
    }

    // remove any invalid archived journals
    const archivedJournals = await this.preferences.get("ARCHIVED_JOURNALS");
    for (const journal of Object.keys(archivedJournals)) {
      if (!(journal in journals)) {
        delete archivedJournals[journal];
      }
    }

    await this.preferences.set("ARCHIVED_JOURNALS", archivedJournals);

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
