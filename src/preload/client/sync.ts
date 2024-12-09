import { Database } from "better-sqlite3";
import fs from "fs";
import { Knex } from "knex";
import path from "path";
import { UUID } from "uuidv7";
import { Files } from "../files";
import { IDocumentsClient } from "./documents";
import { IFilesClient } from "./files";
import { IJournalsClient } from "./journals";
import { IPreferencesClient } from "./preferences";
import { GetDocumentResponse } from "./types";

export type ISyncClient = SyncClient;

// Nobody would put node_modules in their note directory... right?
// todo: Make this configurable
export const SKIPPABLE_FILES = new Set([
  "node_modules",
  "dist",
  "build",
  "out",
]);

// Skip hidden folders and files, especially .git, .DS_Store, .Thumbs.db, etc
// NOTE: This also skips _attachments, so add exclusion in importer routine
export const SKIPPABLE_PREFIXES = new Set([".", "_", "*", "~"]);

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
   * Convert the properties we track to frontmatter
   */
  contentsWithFrontMatter = (document: GetDocumentResponse) => {
    const fm = `---
title: ${document.title}
tags: ${document.tags.join(", ")}
createdAt: ${document.createdAt}
updatedAt: ${document.updatedAt}
---`;

    return `${fm}\n\n${document.content}`;
  };

  /**
   * Sync the notes directory with the database
   */
  sync = async (force = true) => {
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
      // filename is id; ensure it is formatted as a uuidv7
      const documentId = name;

      try {
        UUID.parse(documentId);
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
        await this.files.ensureDir(dirname);
        await this.journals.index(dirname);
        journals[dirname] = 0;
      }

      const { contents, frontMatter } = await this.documents.loadDoc(file.path);

      // todo: handle additional kinds of frontMatter; just add a column for them
      // and ensure they are not overwritten when editing existing files
      // https://github.com/cloverich/chronicles/issues/127

      try {
        await this.documents.createIndex({
          id: documentId,
          journal: dirname, // using name as id
          content: contents,
          title: frontMatter.title,
          tags: frontMatter.tags || [],
          createdAt: frontMatter.createdAt,
          updatedAt: frontMatter.updatedAt,
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

    // Ensure default journal exists; attempt to declare one otherwise
    const defaultJournal = await this.preferences.get("DEFAULT_JOURNAL");

    if (!defaultJournal || !(defaultJournal in journals)) {
      console.log("updating default journal", defaultJournal, journals);

      if (journals.length) {
        await this.preferences.set("DEFAULT_JOURNAL", journals[0]);
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
