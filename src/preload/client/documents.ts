import { Database } from "better-sqlite3";
import fs from "fs";
import { Knex } from "knex";
import path from "path";
import yaml from "yaml";
import {
  mdastToString,
  parseMarkdown,
  selectImageLinks,
  selectNoteLinks,
} from "../../markdown";
import { parseNoteLink } from "../../views/edit/editor/features/note-linking/toMdast";
import { Files } from "../files";
import { IFilesClient } from "./files";
import { parseChroniclesFrontMatter } from "./importer/frontmatter";
import { IPreferencesClient } from "./preferences";

import {
  CreateRequest,
  GetDocumentResponse,
  IndexRequest,
  SearchItem,
  SearchRequest,
  SearchResponse,
  UpdateRequest,
} from "./types";
import { createId } from "./util";

// document as it appears in the database
interface DocumentDb {
  id: string;
  journal: string;
  title?: string;
  content: string;
  frontMatter: string;
  createdAt: string;
  updatedAt: string;
}

// table structure of document_links
interface DocumentLinkDb {
  documentId: string;
  targetId: string;
  targetJournal: string;
  resolvedAt: string; // todo: unused
}

export type IDocumentsClient = DocumentsClient;

export class DocumentsClient {
  constructor(
    private db: Database,
    private knex: Knex,
    private files: IFilesClient,
    private preferences: IPreferencesClient,
  ) {}

  findById = async ({ id }: { id: string }): Promise<GetDocumentResponse> => {
    const document = await this.knex<DocumentDb>("documents")
      .where({ id })
      .first();

    // todo: test 404 behavior
    if (!document) {
      throw new Error(`Document ${id} not found`);
    }

    const filepath = path.join(
      await this.preferences.get("NOTES_DIR"),
      document.journal,
      `${id}.md`,
    );

    // freshly load the document from disk to avoid desync issues
    // todo: a real strategy for keeping db in sync w/ filesystem, that allows
    // loading from db.
    const { contents, frontMatter } = await this.loadDoc(filepath);

    // todo: Are the dates ever null at this point?
    frontMatter.createdAt = frontMatter.createdAt || document.createdAt;
    frontMatter.updatedAt = frontMatter.updatedAt || document.updatedAt;

    // todo: parseChroniclesFrontMatter _should_ migrate my old tags to the new format...
    // the old code would splice in documentTags at this point...
    // const documentTags = await this.knex("document_tags")
    // .where({ documentId: id })
    // .select("tag");
    // frontMatter.tags = frontMatter.tags || documentTags.map((t) => t.tag);

    return {
      ...document,
      frontMatter,
      content: contents,
    };
  };

  // load a document + parse frontmatter from a file
  loadDoc = async (path: string) => {
    // todo: validate path is in notes dir
    // const rootDir = await this.preferences.get("NOTES_DIR");
    // todo: sha comparison
    const contents = await Files.read(path);
    const stats = await fs.promises.stat(path);
    const { frontMatter, body } = parseChroniclesFrontMatter(contents, stats);

    return { contents: body, frontMatter };
  };

  del = async (id: string, journal: string) => {
    await this.files.deleteDocument(id, journal);
    await this.knex<DocumentDb>("documents").where({ id }).del();
  };

  search = async (q?: SearchRequest): Promise<SearchResponse> => {
    let query = this.knex<DocumentDb>("documents");

    // filter by journal
    if (q?.journals?.length) {
      query = query.whereIn("journal", q.journals);
    }

    if (q?.tags?.length) {
      query = query
        .join("document_tags", "documents.id", "document_tags.documentId")
        .whereIn("document_tags.tag", q.tags);
    }

    // filter by title
    if (q?.titles?.length) {
      for (const title of q.titles) {
        // note: andWhereILike throws a SQL syntax error in SQLite.
        // It seems case insensitive without it?
        query = query.andWhereLike("title", `%${title}%`);
      }
    }

    // filter by raw text
    if (q?.texts?.length) {
      for (const rawTxt of q.texts) {
        query = query.andWhereLike("content", `%${rawTxt}%`);
      }
    }

    // todo: test id, date, and unknown formats
    if (q?.before) {
      if (this.beforeTokenFormat(q.before) === "date") {
        query = query.andWhere("createdAt", "<", q.before);
      } else {
        query = query.andWhere("id", "<", q.before);
      }
    }

    if (q?.limit) {
      query = query.limit(q.limit);
    }

    query.orderBy("createdAt", "desc");

    try {
      const results = await query;
      return { data: results as unknown as SearchItem[] };
    } catch (err) {
      console.error("error in clinet.documents.search", err);
    }

    return { data: [] };
  };

  // Extend front-matter (if any) with Chronicles standard properties, then
  // add to serialized document contents.
  private prependFrontMatter = (
    contents: string,
    frontMatter: Record<string, any>,
  ) => {
    // need to re-add ---, and also double-newline the ending frontmatter
    const fm = ["---", yaml.stringify(frontMatter), "---"].join("\n");

    return `${fm}\n\n${contents}`;
  };

  /**
   * Create (upload) a new document and index it
   * @param args - The document to create
   * @param index - Whether to index the document - set to false when importing (we import, then call `sync` instead)
   */
  createDocument = async (
    args: CreateRequest,
    index: boolean = true,
  ): Promise<[string, string]> => {
    args.frontMatter.tags = Array.from(new Set(args.frontMatter.tags));
    args.frontMatter.createdAt =
      args.frontMatter.createdAt || new Date().toISOString();
    args.frontMatter.updatedAt =
      args.frontMatter.updatedAt || new Date().toISOString();

    const id = args.id || createId(Date.parse(args.frontMatter.createdAt));

    const content = this.prependFrontMatter(args.content, args.frontMatter);
    const docPath = await this.files.uploadDocument(
      { id, content },
      args.journal,
    );

    if (index) {
      return [
        await this.createIndex({
          id,
          journal: args.journal,
          content,
          frontMatter: args.frontMatter,
          rootDir: await this.preferences.get("NOTES_DIR"),
        }),
        docPath,
      ];
    } else {
      return [id, docPath];
    }
  };

  updateDocument = async (args: UpdateRequest): Promise<void> => {
    if (!args.id) throw new Error("id required to update document");

    args.frontMatter.tags = Array.from(new Set(args.frontMatter.tags));
    // todo: I think we accept this from the client now and just expect
    // callers to update updatedAt, to support importers and sync manually configuring
    // this...
    args.frontMatter.updatedAt =
      args.frontMatter.updatedAt || new Date().toISOString();

    const content = this.prependFrontMatter(args.content, args.frontMatter);

    const origDoc = await this.findById({ id: args.id });
    await this.files.uploadDocument({ id: args.id, content }, args.journal);

    // sigh; this is a bit of a mess.
    if (origDoc.journal !== args.journal) {
      // delete the original markdown file, in the old journal
      // no await, optimistic delete
      this.files.deleteDocument(args.id!, origDoc.journal);
      // update any markdown files which had links pointing to the old journal
      // only necessary because we use markdown links, i.e. ../<journal>/<id>.md
      this.updateDependentLinks([args.id!], args.journal);
    }

    await this.updateIndex({
      id: args.id,
      content,
      journal: args.journal,
      frontMatter: args.frontMatter,
      rootDir: await this.preferences.get("NOTES_DIR"),
    });
  };

  // todo: also need to update dependent title, if the title of the original note
  // changes...again wikilinks simplify this.
  private updateDependentLinks = async (
    documentIds: string[],
    journal: string,
  ) => {
    for (const targetId of documentIds) {
      const links = await this.knex<DocumentLinkDb>("document_links").where({
        targetId,
      });

      for (const link of links) {
        const dependentNote = await this.findById({ id: link.documentId });
        console.log(
          "udating links for",
          dependentNote.frontMatter.title,
          dependentNote.id,
        );
        const mdast = parseMarkdown(dependentNote.content);
        const noteLinks = selectNoteLinks(mdast);

        // update the note links to point to the new journal
        noteLinks.forEach((link) => {
          const parsed = parseNoteLink(link.url);
          if (!parsed) return;
          const { noteId } = parsed;
          if (noteId === targetId) {
            // update url to new journal
            link.url = `../${journal}/${noteId}.md`;
            link.journalName = journal;
          }
        });

        await this.updateDocument({
          ...dependentNote,
          content: mdastToString(mdast),
        });
      }
    }
  };

  createIndex = async ({
    id,
    journal,
    content,
    frontMatter,
    rootDir,
  }: IndexRequest): Promise<string> => {
    if (!id) {
      throw new Error("id required to create document index");
    }

    return this.knex.transaction(async (trx) => {
      await trx("documents").insert({
        id,
        journal,
        content,
        title: frontMatter.title,
        createdAt: frontMatter.createdAt,
        updatedAt: frontMatter.updatedAt,
        frontMatter: JSON.stringify(frontMatter || {}),
      });

      if (frontMatter.tags.length > 0) {
        await trx("document_tags").insert(
          frontMatter.tags.map((tag: string) => ({ documentId: id, tag })),
        );
      }

      await this.addNoteLinks(trx, id, content);
      await this.addImageLinks(trx, id, content, rootDir, journal);

      return id;
    });
  };

  updateIndex = async ({
    id,
    journal,
    content,
    frontMatter,
    rootDir,
  }: IndexRequest): Promise<void> => {
    return this.knex.transaction(async (trx) => {
      await trx("documents")
        .update({
          content,
          title: frontMatter.title,
          journal,
          updatedAt: frontMatter.updatedAt,
          frontMatter: JSON.stringify(frontMatter),
        })
        .where({ id });

      await trx("document_tags").where({ documentId: id }).del();
      if (frontMatter.tags.length > 0) {
        await trx("document_tags").insert(
          frontMatter.tags.map((tag: string) => ({ documentId: id, tag })),
        );
      }

      await trx("document_links").where({ documentId: id }).del();
      await this.addNoteLinks(trx, id!, content);
      await this.addImageLinks(trx, id, content, rootDir, journal);
    });
  };

  // track image links for a document to assist debugging missing images. Unlike note links, which
  // are live and updated as part of document udpate process, as of now this routine exists purlely
  // for debugging import / sync issues.
  private addImageLinks = async (
    trx: Knex.Transaction,
    documentId: string,
    content: string,
    rootDir: string,
    journal: string,
  ) => {
    const mdast = parseMarkdown(content);
    const imageLinks = selectImageLinks(mdast).map((image) => image.url);

    // Delete existing image links for this document
    await trx("image_links").where({ documentId }).del();

    if (imageLinks.length > 0) {
      // Check each image and insert into the table
      for (const imagePath of imageLinks) {
        // Skip non-local files (http, https, etc)
        if (imagePath.startsWith("http")) {
          continue;
        }

        // Resolve relative path against notes directory
        const resolvedPath = path.resolve(rootDir, journal, imagePath);
        const resolved = await this.files.validFile(resolvedPath, false);
        await trx("image_links").insert({
          documentId,
          imagePath,
          resolved,
          lastChecked: new Date().toISOString(),
        });
      }
    }
  };

  private addNoteLinks = async (
    trx: Knex.Transaction,
    documentId: string,
    content: string,
  ) => {
    const mdast = parseMarkdown(content);
    const noteLinks = selectNoteLinks(mdast)
      .map((link) => parseNoteLink(link.url))
      .filter(Boolean) as { noteId: string; journalName: string }[];

    // drop duplicate note links, should only point to a noteId once
    const seen = new Set<string>();
    const noteLinksUnique = noteLinks.filter((link) => {
      if (seen.has(link.noteId)) {
        return false;
      } else {
        seen.add(link.noteId);
        return true;
      }
    });

    if (noteLinks.length > 0) {
      await trx("document_links").insert(
        noteLinksUnique.map((link) => ({
          documentId,
          targetId: link.noteId,
          targetJournal: link.journalName,
        })),
      );
    }
  };

  /**
   * When removing a journal, call this to de-index all documents from that journal.
   */
  deindexJournal = (journal: string): Promise<void> => {
    return this.knex<DocumentDb>("documents").where({ journal }).del();
  };

  /**
   * For a given before: token, determine if the value is a date, an ID, or
   * unknown. This allows paginating / ordering off of before using either
   * createdAt or ID.
   *
   * @param input - The value of the before: token
   */
  beforeTokenFormat = (input: string): "date" | "id" | "unknown" => {
    // Regular expression for ISO date formats: full, year-month, year only
    const dateRegex = /^(?:\d{4}(?:-\d{2}(?:-\d{2})?)?)$/;
    // Regular expression for the specific ID format
    const idRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (dateRegex.test(input)) {
      return "date";
    } else if (idRegex.test(input)) {
      return "id";
    } else {
      return "unknown";
    }
  };
}
