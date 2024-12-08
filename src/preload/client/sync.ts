import { Database } from "better-sqlite3";
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

const SKIPPABLE_FILES = new Set(".DS_Store");

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

    for await (const file of Files.walk(rootDir, () => true, {
      // depth: dont go into subdirectories
      depthLimit: 1,
    })) {
      // For some reason it yields the root folder first, what is the point of that shrug
      if (file.path == rootDir) continue;

      const { ext, name, dir } = path.parse(file.path);
      if (name.startsWith(".")) continue;
      if (SKIPPABLE_FILES.has(name)) continue;

      if (file.stats.isDirectory()) {
        const dirname = name;
        if (dirname === "_attachments") {
          continue;
        }

        // Defer creating journals until we find a markdown file
        // in the directory
        continue;
      }

      // Only process markdown files
      if (ext !== ".md") continue;

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

      // _attachments is for images (etc), not notes
      if (dirname === "_attachments") {
        continue;
      }

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
