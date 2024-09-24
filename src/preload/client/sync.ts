import { Database } from "better-sqlite3";
import { Knex } from "knex";
import path from "path";
import yaml from "yaml";
import { Files } from "../files";
import { GetDocumentResponse, IDocumentsClient } from "./documents";
import { IFilesClient } from "./files";
import { IJournalsClient } from "./journals";
import { IPreferencesClient } from "./preferences";

export type ISyncClient = SyncClient;

function preprocessFrontMatter(content: string) {
  // Regular expression to match key-value pairs in front matter
  return content
    .replace(/^(\w+):\s*$/gm, '$1: ""') // Handle keys with no values
    .replace(/^(\w+):\s*(.+)$/gm, (match, key, value) => {
      // Check if value contains special characters that need quoting
      if (value.match(/[:{}[\],&*#?|\-<>=!%@`]/) || value.includes("\n")) {
        // If the value is not already quoted, wrap it in double quotes
        if (!/^['"].*['"]$/.test(value)) {
          // Escape any existing double quotes in the value
          value = value.replace(/"/g, '\\"');
          return `${key}: "${value}"`;
        }
      }
      return match; // Return unchanged if no special characters
    });
}

// naive regex for matching uuidv7, for checking filenames match the format
const uuidv7Regex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// naive frontmatter parser
function parseFrontMatter(content: string) {
  // Regular expression to match front matter (--- at the beginning and end)
  const frontMatterRegex = /^---\n([\s\S]*?)\n---\n*/;

  // Match the front matter
  const match = content.match(frontMatterRegex);
  if (!match) {
    return {
      frontMatter: {}, // No front matter found
      body: content, // Original content without changes
    };
  }

  // Extract front matter and body
  const frontMatterContent = preprocessFrontMatter(match[1]);
  const body = content.slice(match[0].length); // Content without front matter

  // Parse the front matter using yaml
  const frontMatter = yaml.parse(frontMatterContent);
  frontMatter.tags = frontMatter.tags
    .split(",")
    .map((tag: string) => tag.trim())
    .filter(Boolean);

  return {
    frontMatter,
    body,
  };
}

export class SyncClient {
  constructor(
    private db: Database,
    private knex: Knex,
    private journals: IJournalsClient,
    private documents: IDocumentsClient,
    private files: IFilesClient,
    private preferences: IPreferencesClient,
  ) {}

  private selectImages = (mdast: any, images: any = new Set()) => {
    if (mdast.type === "image") {
      images.add(mdast.url);
    }

    if (mdast.children) {
      for (const child of mdast.children) {
        this.selectImages(child, images);
      }
    }

    return images;
  };

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
  sync = async () => {
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
    const rootFolderName = path.basename(rootDir);

    // Track created journals and number of documents to help troubleshoot
    // sync issues
    const journals: Record<string, number> = {};
    const erroredDocumentPaths: string[] = [];

    for await (const file of Files.walk(rootDir, () => true, {
      // depth: dont go into subdirectories
      depthLimit: 1,
    })) {
      // For some reason it yields the root folder first, what is the point of that shrug
      if (file.path == rootDir) continue;
      if (file.path.includes(".DS_Store")) continue;
      const { ext, name } = path.parse(file.path);
      if (name.startsWith(".")) continue;

      if (file.stats.isDirectory()) {
        const directory = path.basename(file.path);
        if (directory === "_attachments") {
          continue;
        }

        // This is creating a journal outside of the journals store... which caches the
        // initial list of journals
        if (!(directory in journals)) {
          await this.files.ensureDir(file.path);
          await this.journals.index(directory);
          journals[directory] = 0;
        }

        continue;
      }

      if (ext !== ".md") continue;

      // filename is id; ensure it is formatted as a uuidv7
      const documentId = path.basename(file.path).replace(".md", "");

      if (!uuidv7Regex.test(documentId)) {
        console.error("Invalid document id", documentId);
        continue;
      }

      // treated as journal name
      // NOTE: This directory check only works because we limit depth to 1
      const directory = path.basename(path.dirname(file.path));

      // _attachments is for images (etc), not notes
      if (directory == "_attachments") {
        continue;
      }

      // todo: sha comparison
      const contents = await Files.read(file.path);
      const { frontMatter, body } = parseFrontMatter(contents);

      // In a directory that was pre-formatted by Chronicles, this should not
      // be needed. Will leave here as a reminder when I do the more generalized
      // import routine.
      if (!frontMatter.createdAt) {
        frontMatter.createdAt = file.stats.ctime.toISOString();
        frontMatter.updatedAt = file.stats.mtime.toISOString();
      }

      // todo: handle additional kinds of frontMatter; just add a column for them
      // and ensure they are not overwritten when editing existing files
      // https://github.com/cloverich/chronicles/issues/127

      try {
        await this.documents.createIndex({
          id: documentId,
          journal: directory, // using name as id
          content: body,
          title: frontMatter.title,
          tags: frontMatter.tags || [],
          createdAt: frontMatter.createdAt,
          updatedAt: frontMatter.updatedAt,
        });
      } catch (e) {
        erroredDocumentPaths.push(file.path);

        // https://github.com/cloverich/chronicles/issues/248
        console.error(
          "Error with document",
          documentId,
          "for journal",
          directory,
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

    // todo: track this in a useful way...
    console.log("Errored documents (during sync)", erroredDocumentPaths);
  };
}
