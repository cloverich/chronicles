import { Database } from "better-sqlite3";
import Store from "electron-store";
import { Knex } from "knex";
import { stringToMdast } from "../../markdown";
import { Files } from "../files";
import { GetDocumentResponse, IDocumentsClient } from "./documents";
import { IFilesClient } from "./files";
import { IJournalsClient } from "./journals";

export type IExportClient = ExportClient;

export class ExportClient {
  constructor(
    private db: Database,
    private knex: Knex,
    private journals: IJournalsClient,
    private documents: IDocumentsClient,
    private files: IFilesClient,
    private settings: Store,
  ) {}

  selectImages = (mdast: any, images: any = new Set()) => {
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

  export = async (rootDir: string) => {
    const journals = await this.journals.list();

    const journalIdNameMapping = journals.reduce(
      (acc, jrnl) => {
        acc[jrnl.id] = jrnl.name;
        return acc;
      },
      {} as Record<string, string>,
    );

    // Collect these as we go
    const attachments = new Set();

    const docs = await this.documents.search({
      titles: ["Constrain image sizes"],
      journals: [],
    });

    for (const journal of journals) {
      const documents = await this.documents.search({ journals: [journal.id] });
      // console.log("Found", documents.data.length, "in", journal.name);
      for (const document of documents.data) {
        // extract and track image references
        const fullDocument = await this.documents.findById({ id: document.id });
        const parsed = stringToMdast(fullDocument.content);
        const images = this.selectImages(parsed);
        images.forEach((img: string) => attachments.add(img));

        // update attachment references
        images.forEach((imgUrl: string) => {
          const updatedUrl = `../_attachments/${imgUrl}`;
          // console.log(imgUrl, "->", updatedUrl);
          fullDocument.content = fullDocument.content.replace(
            imgUrl,
            updatedUrl,
          );
        });

        // Create frontmatter
        fullDocument.content = this.contentsWithFrontMatter(fullDocument);

        // update note links: Replace '../<journal_id>/<document_id>.md' with
        // '../<journal_name>/<document_id>.md'
        Object.keys(journalIdNameMapping).forEach((journalId) => {
          if (fullDocument.content.includes(journalId)) {
            fullDocument.content = fullDocument.content.replace(
              journalId,
              journalIdNameMapping[journalId],
            );
          }
        });

        this.files.uploadDocument(rootDir, fullDocument, journal.name);
      }
    }

    // note: manually copied images directory (to rootDir/_attachments/)
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

  walk = async (rootDir: string) => {
    for await (const file of Files.walk(rootDir, () => true)) {
      console.log(file.path, file.stats.ctime, file.stats.isDirectory());
    }
  };
}
