import { Database } from "better-sqlite3";
import { Knex } from "knex";
import path from "path";
import { uuidv7obj } from "uuidv7";
import yaml from "yaml";
import { mdastToString, parseMarkdown, selectNoteLinks } from "../../markdown";
import { parseNoteLink } from "../../views/edit/editor/features/note-linking/toMdast";
import { Files } from "../files";
import { IFilesClient } from "./files";
import { parseChroniclesFrontMatter } from "./importer/frontmatter";
import { IPreferencesClient } from "./preferences";

import {
  GetDocumentResponse,
  IndexRequest,
  SaveRequest,
  SearchItem,
  SearchRequest,
  SearchResponse,
} from "./types";

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
    const document = await this.knex("documents").where({ id }).first();

    // todo: test 404 behavior
    if (!document) {
      throw new Error(`Document ${id} not found`);
    }

    // todo: confirm this pulls out tags correctly post knex change
    // todo: should this be dropped, and we just pull tags from the content?
    // tags table is then only used for search as a cache, similar to content and title
    const documentTags = await this.knex("document_tags")
      .where({ documentId: id })
      .select("tag");

    const filepath = path.join(
      await this.preferences.get("NOTES_DIR"),
      document.journal,
      `${id}.md`,
    );

    // freshly load the document from disk to avoid desync issues
    // todo: a real strategy for keeping db in sync w/ filesystem, that allows
    // loading from db.
    const { contents, frontMatter } = await this.loadDoc(filepath);

    return {
      ...document,
      frontMatter,
      contents,
      tags: documentTags,
    };
  };

  // load a document + parse frontmatter from a file
  loadDoc = async (path: string) => {
    // todo: validate path is in notes dir
    // const rootDir = await this.preferences.get("NOTES_DIR");
    // todo: sha comparison
    const contents = await Files.read(path);
    const { frontMatter, body } = parseChroniclesFrontMatter(contents);

    return { contents: body, frontMatter };
  };

  del = async (id: string, journal: string) => {
    await this.files.deleteDocument(id, journal);
    await this.knex("documents").where({ id }).del();
  };

  search = async (q?: SearchRequest): Promise<SearchResponse> => {
    let query = this.knex("documents");

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

  /**
   * Create or update a document and its tags
   *
   * todo: test; for tags: test prefix is removed, spaces are _, lowercased, max length
   * todo: test description max length
   *
   * @returns - The document as it exists after the save
   */
  save = async (args: SaveRequest): Promise<GetDocumentResponse> => {
    // de-dupe tags -- should happen before getting here.
    args.tags = Array.from(new Set(args.tags));
    let id;

    args.title = args.title;
    args.updatedAt = args.updatedAt || new Date().toISOString();

    if (args.id) {
      this.updateDocument(args);
      id = args.id;
    } else {
      args.createdAt = new Date().toISOString();
      [id] = await this.createDocument(args);
    }

    return this.findById({ id });
  };

  // Extend front-matter (if any) with Chronicles standard properties, then
  // add to serialized document contents.
  prependFrontMatter = (contents: string, frontMatter: Record<string, any>) => {
    // need to re-add ---, and also double-newline the ending frontmatter
    const fm = ["---", yaml.stringify(frontMatter), "---"].join("\n");

    return `${fm}\n\n${contents}`;
  };

  mergedFrontMatter = (document: SaveRequest): Record<string, any> => {
    return {
      ...(document.frontMatter || {}),
      title: document.title,
      tags: document.tags,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  };

  /**
   * Create (upload) a new document and index it
   * @param args - The document to create
   * @param index - Whether to index the document - set to false when importing (we import, then call `sync` instead)
   */
  createDocument = async (
    args: SaveRequest,
    index: boolean = true,
  ): Promise<[string, string]> => {
    const id = args.id || uuidv7obj().toHex();
    const frontMatter = this.mergedFrontMatter(args);
    frontMatter.createdAt = frontMatter.createdAt || new Date().toISOString();
    frontMatter.updatedAt = frontMatter.updatedAt || new Date().toISOString();

    const content = this.prependFrontMatter(args.content, frontMatter);
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
          frontMatter,
        }),
        docPath,
      ];
    } else {
      return [id, docPath];
    }
  };

  private updateDocument = async (args: SaveRequest): Promise<void> => {
    if (!args.id) throw new Error("id required to update document");

    const frontMatter = this.mergedFrontMatter(args);
    frontMatter.updatedAt = new Date().toISOString();
    const content = this.prependFrontMatter(args.content, frontMatter);

    const origDoc = await this.findById({ id: args.id! });
    await this.files.uploadDocument({ id: args.id!, content }, args.journal);

    // sigh; this is a bit of a mess
    if (origDoc.journal !== args.journal) {
      // no await, optimistic delete
      this.files.deleteDocument(args.id!, origDoc.journal);
      this.updateDependentLinks([args.id!], args.journal);
    }

    return await this.updateIndex({
      id: args.id!,
      content,
      journal: args.journal,
      frontMatter,
    });
  };

  // todo: also need to update dependent title, if the title of the original note
  // changes...again wikilinks simplify this.
  updateDependentLinks = async (documentIds: string[], journal: string) => {
    for (const targetId of documentIds) {
      const links = await this.knex<DocumentLinkDb>("document_links").where({
        targetId,
      });

      for (const link of links) {
        const dependentNote = await this.findById({ id: link.documentId });
        console.log("udating links for", dependentNote.title, dependentNote.id);
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

        await this.save({
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
        frontMatter: yaml.stringify(frontMatter || {}),
      });

      if (frontMatter.tags.length > 0) {
        await trx("document_tags").insert(
          frontMatter.tags.map((tag: string) => ({ documentId: id, tag })),
        );
      }

      await this.addNoteLinks(trx, id, content);

      return id;
    });
  };

  updateIndex = async ({
    id,
    journal,
    content,
    frontMatter,
  }: IndexRequest): Promise<void> => {
    return this.knex.transaction(async (trx) => {
      await trx("documents")
        .update({
          content,
          title: frontMatter.title,
          journal,
          updatedAt: frontMatter.updatedAt,
          frontMatter: yaml.stringify(frontMatter),
        })
        .where({ id });

      await trx("document_tags").where({ documentId: id }).del();
      if (frontMatter.tags.length > 0) {
        await trx("document_tags").insert(
          frontMatter.tags.map((tag: string) => ({ documentId: id, tag })),
        );
      }

      // todo: pass trx to addNoteLinks
      await this.addNoteLinks(trx, id!, content);
    });
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
    return this.knex("documents").where({ journal }).del();
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
