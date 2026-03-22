import { and, count, eq, ne } from "drizzle-orm";
import { type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as mdast from "mdast";
import path from "path";

import {
  isNoteLink,
  mdastToString,
  parseMarkdownForImportProcessing,
} from "../markdown";
import { SourceType } from "../preload/client/importer/SourceType";
import { parseTitleAndFrontMatterForImport } from "../preload/client/importer/frontmatter";
import {
  MAX_NAME_LENGTH as MAX_JOURNAL_NAME_LENGTH,
  validateJournalName,
} from "../preload/client/journals";
import {
  FrontMatter,
  SKIPPABLE_FILES,
  SKIPPABLE_PREFIXES,
} from "../preload/client/types";
import { createId } from "../preload/client/util";
import { PathStatsFile, walk } from "../preload/utils/fs-utils";
import type { IDocumentsClient } from "./documents";
import type { NodeFilesClient } from "./files";
import { FilesImportResolver } from "./files-import-resolver";
import type { IIndexerClient } from "./indexer";
import type { PreferencesClient } from "./preferences";
import * as schema from "./schema";

export type IImporterClient = ImporterClient;

// UUID in Notion notes look like 32 character hex strings; make this somewhat more lenient
const hexIdRegex = /\b[0-9a-f]{16,}\b/;

/**
 * Strip the id from Notion filenames
 *
 * todo: add tests
 *
 * Notion filenames are formatted as `title UUID`
 * example: My Note f35b7cabdf98421d94a27722f0fbdeb8
 *
 * @param filename - The filename (not path, no extension) to strip the UUID from
 * @returns [string, string] - title, id (if present)
 */
function stripNotionIdFromTitle(filename: string): [string, string?] {
  const lastSpaceIndex = filename.lastIndexOf(" ");

  // Only strip if a space and UUID are present after the space
  if (
    lastSpaceIndex > 0 &&
    hexIdRegex.test(filename.slice(lastSpaceIndex + 1))
  ) {
    const name = filename.substring(0, lastSpaceIndex).trim();
    const id = filename.substring(lastSpaceIndex + 1).trim();
    return [name, id];
  }

  // Missing id is defensive; might arise if assumption or actual format of Notion ID structure
  // or filename structure changes.
  return [filename.trim(), undefined];
}

// Note as staged in the import_notes table
interface StagedNote {
  // where the note comes from
  importerId: string;
  sourcePath: string;
  sourceId?: string;

  // may be empty if could not parse body
  // correctly
  journal: string;
  content: string;
  frontMatter: string; // FrontMatter (json)

  // Where this note will end up
  chroniclesId: string;
  chroniclesPath: string;
  status: string; // 'pending' | 'note_created'
  error?: string | null;
}

export class ImporterClient {
  constructor(
    private db: BetterSQLite3Database<typeof schema>,
    private documents: IDocumentsClient,
    private files: NodeFilesClient,
    private preferences: PreferencesClient,
    private indexer: IIndexerClient,
    private notesDir: string,
  ) {}

  processPending = async () => {
    const pendingImports = await this.db
      .select()
      .from(schema.imports)
      .where(eq(schema.imports.status, "pending"));

    for (const pendingImport of pendingImports) {
      await this.processStagedNotes(
        this.notesDir,
        SourceType.Other,
        new FilesImportResolver(this.db, pendingImport.id, this.files),
      );
    }
  };

  /**
   * Imports importDir into the chronicles root directory, grabbing all markdown
   * and linked files; makes the following changes:
   * - Moves all markdown files to the chronicles root directory
   * - Flattents to one-directory deep and updates links
   * - Re-names all files to use a unique ID for their name
   * - Copies all referenced files to the _attachments directory
   *
   * Designed for my own Notion export, and assumes indexer will be called afterwards.
   */
  import = async (
    importDir: string,
    sourceType: SourceType = SourceType.Other,
  ) => {
    // await this.clearImportTables();
    importDir = path.resolve(importDir);

    await this.clearIncomplete();
    const importerId = createId();
    const chroniclesRoot = this.notesDir;

    // Ensure `importDir` is a directory and can be accessed
    await this.files.ensureDir(importDir);

    // Confirm its not a sub-directory of the notes root `rootDir`
    if (importDir.startsWith(chroniclesRoot)) {
      throw new Error(
        "Import directory must not reside within the chronicles root directory",
      );
    }

    // track, so if we have errors and want to re-run to fix remaining pending items,
    // we can. This is mostly for debugging.
    try {
      await this.db.insert(schema.imports).values({
        id: importerId,
        status: "pending",
        importDir,
      });
    } catch (err) {
      console.error("Error saving import", importerId, importDir, err);
      throw err;
    }

    // todo: also create a NotesImportResolver to handle note links rather than mixing
    // into this importer class
    const resolver = new FilesImportResolver(this.db, importerId, this.files);

    // stage all notes and files in the import directory for processing.
    // we do this in two steps so we can generate mappings of source -> dest
    // for links and files, and then update them in the second pass.
    await this.stageNotes(
      importDir,
      importerId,
      chroniclesRoot,
      sourceType,
      resolver,
    );

    await this.processStagedNotes(chroniclesRoot, sourceType, resolver);
  };

  // pre-process all notes and files in the import directory, tracking in the import tables
  // for later processing
  private stageNotes = async (
    importDir: string,
    importerId: string,
    chroniclesRoot: string, // absolute path to chronicles root dir
    sourceType: SourceType,
    resolver: FilesImportResolver,
  ) => {
    // for processNote; maps the original folder path to the fixed name
    const journalsMapping: Record<string, string> = {};

    for await (const file of walk(
      importDir,
      10, // random guess at reasoable max depth

      (dirent) => {
        // Skip hidden files and directories
        if (dirent.name.startsWith(".")) return false;
        if (SKIPPABLE_FILES.has(dirent.name)) return false;

        // Skip prefixes including _, unless its _attachments
        if (dirent.name === "_attachments") return true;
        for (const prefix of SKIPPABLE_PREFIXES) {
          if (dirent.name.startsWith(prefix)) return false;
        }

        return true;
      },
    )) {
      if (file.path.endsWith(".md")) {
        await this.stageNote(
          file,
          importDir,
          importerId,
          journalsMapping,
          sourceType,
        );
      } else {
        resolver.stageFile(file);
      }
    }
  };

  // stage a single note for processing
  private stageNote = async (
    file: PathStatsFile,
    importDir: string,
    importerId: string,
    journals: Record<string, string>, // mapping of original folder path to journal name
    sourceType: SourceType,
  ) => {
    const { name, dir } = path.parse(file.path);

    // todo: sha comparison
    const contents = await this.files.readDocument(file.path);

    try {
      // todo: fallback title to filename - uuid
      const { frontMatter, body } = parseTitleAndFrontMatterForImport(
        contents,
        name,
        sourceType,
      );

      const journalName = this.inferJournalName(
        dir,
        importDir,
        journals,
        sourceType,
        // See notes in inferOrGenerateJournalName; this is very specific
        // to my Notion export.
        frontMatter.Category,
      );

      // Prefer front-matter supplied create and update times, but fallback to file stats
      // todo: check updatedAt, "Updated At", "Last Edited", etc. i.e. support more possible
      // front-matter keys for dates; probably needs to be configurable:
      // 1. Which key(s) to check
      // 2. Whether to use birthtime or mtime
      // 3. Which timezone to use
      // 4. Whether to use the front-matter date or the file date
      const createdAtDate = frontMatter.createdAt
        ? new Date(Date.parse(frontMatter.createdAt))
        : file.stats.birthtime || file.stats.mtime || new Date();

      const requiredFm: FrontMatter = {
        ...frontMatter,
        tags: frontMatter.tags || [],
        createdAt: frontMatter.createdAt || createdAtDate.toISOString(),
        updatedAt:
          frontMatter.updatedAt ||
          file.stats.mtime.toISOString() ||
          new Date().toISOString(),
      };

      const chroniclesId = createId(createdAtDate.getTime());

      const stagedNote: StagedNote = {
        importerId,
        chroniclesId: chroniclesId,
        // hmm... what am I going to do with this? Should it be absolute to notesDir?
        chroniclesPath: `${path.join(journalName, chroniclesId)}.md`,
        sourcePath: file.path,
        content: body,
        journal: journalName,
        frontMatter: JSON.stringify(requiredFm),
        status: "pending",
      };

      if (sourceType === SourceType.Notion) {
        const [, notionId] = stripNotionIdFromTitle(name);
        stagedNote.sourceId = notionId;
      }

      await this.db.insert(schema.importNotes).values(stagedNote);
    } catch (e) {
      // todo: this error handler is too big
      if ((e as any).code === "SQLITE_CONSTRAINT_PRIMARYKEY") {
        console.log("Skipping re-import of note", file.path);
      } else {
        // track staging errors for review. For example, if a note has a title
        // that is too long, or a front-matter key that is not supported, etc, user
        // can use table logs to fix and re-run th e import
        try {
          await this.db.insert(schema.importNotes).values({
            importerId,
            sourcePath: file.path,
            content: contents,
            error: (e as Error).message || "staging_error",

            // note: these all have non-null / unique constraints;
            // its expected re-processing will delete / replace these values
            chroniclesId: createId(),
            chroniclesPath: "staging_error",
            journal: "staging_error",
            frontMatter: "{}",
            status: "staging_error",
          });
        } catch (err) {
          console.error("Error tracking staging import error", file.path, err);
        }
      }
    }
  };

  // Second pass; process all staged notes and files
  private processStagedNotes = async (
    chroniclesRoot: string,
    sourceType: SourceType,
    resolver: FilesImportResolver,
  ) => {
    const [pendingImport] = await this.db
      .select({ id: schema.imports.id, importDir: schema.imports.importDir })
      .from(schema.imports)
      .where(eq(schema.imports.status, "pending"))
      .limit(1);

    if (!pendingImport) {
      console.log("No pending imports");
      return;
    }

    const { id: importerId, importDir } = pendingImport;
    console.log("Processing import", importerId, importDir);

    const { linkMapping, wikiLinkMapping } =
      await this.buildLinkMappings(importerId);

    const items = await this.db
      .select()
      .from(schema.importNotes)
      .where(
        and(
          eq(schema.importNotes.importerId, importerId),
          eq(schema.importNotes.status, "pending"),
        ),
      );

    // Track which journals have been ensured to avoid redundant DB/FS work
    const ensuredJournals = new Set<string>();

    // First pass: update all file links in notes (marks files as "referenced")
    const mdastTrees = new Map<string, mdast.Root>();

    for (const item of items) {
      const mdastTree = parseMarkdownForImportProcessing(
        item.content!,
      ) as any as mdast.Root;
      await this.updateNoteLinks(
        mdastTree,
        item as StagedNote,
        linkMapping,
        wikiLinkMapping,
      );
      await resolver.updateFileLinks(item.sourcePath, mdastTree);
      mdastTrees.set(item.sourcePath, mdastTree);
    }

    // Move all referenced files in one batch, then mark orphans
    await resolver.moveStagedFiles(chroniclesRoot, importerId, importDir);

    // Second pass: convert wiki nodes, extract tags, create documents
    for (const item of items) {
      const mdastTree = mdastTrees.get(item.sourcePath)!;
      const frontMatter: FrontMatter = JSON.parse(item.frontMatter!);

      this.convertWikiLinks(mdastTree);

      // process inline tags into front matter
      frontMatter.tags = Array.from(
        new Set(this.processAndConvertTags(mdastTree, frontMatter.tags || [])),
      );

      // with updated links we can now save the document
      try {
        // Ensure journal row exists in DB (FK constraint) before inserting document.
        if (!ensuredJournals.has(item.journal)) {
          await this.ensureJournal(item.journal);
          ensuredJournals.add(item.journal);
        }

        await this.documents.createDocument({
          id: item.chroniclesId,
          journal: item.journal, // using name as id
          content: mdastToString(mdastTree),
          frontMatter,
        });

        await this.db
          .update(schema.importNotes)
          .set({ status: "note_created", error: null })
          .where(
            and(
              eq(schema.importNotes.importerId, item.importerId),
              eq(schema.importNotes.sourcePath, item.sourcePath),
            ),
          );
      } catch (err: any) {
        await this.db
          .update(schema.importNotes)
          .set({
            status: "processing_error",
            error: (err as Error).message || "processing_error",
          })
          .where(
            and(
              eq(schema.importNotes.importerId, item.importerId),
              eq(schema.importNotes.sourcePath, item.sourcePath),
            ),
          );
        // todo: pre-validate ids are unique
        // https://github.com/cloverich/chronicles/issues/248
        console.error(
          "Error creating document after import",
          item.sourcePath,
          err,
        );
      }
    }

    // check for errors
    const [errorResult] = await this.db
      .select({ error_count: count() })
      .from(schema.importNotes)
      .where(
        and(
          eq(schema.importNotes.importerId, importerId),
          eq(schema.importNotes.status, "processing_error"),
        ),
      );

    const error_count = errorResult?.error_count ?? 0;

    console.log("import completed; errors count:", error_count);
    if (!error_count) {
      await this.db
        .update(schema.imports)
        .set({ status: "complete" })
        .where(eq(schema.imports.id, importerId));
    }

    console.log("import complete; calling indexer to update indexes");

    await this.indexer.index(true);
  };

  // Ensure a journal row exists in the DB before inserting a document that references it.
  // During import, journals are inferred from folder names and may not yet exist in the DB.
  // The indexer will later reconcile journal rows with the filesystem, so this just ensures
  // the FK constraint is satisfied.
  private ensureJournal = async (journalName: string) => {
    const timestamp = new Date().toISOString();
    await this.db
      .insert(schema.journals)
      .values({ name: journalName, createdAt: timestamp, updatedAt: timestamp })
      .onConflictDoNothing();

    // Ensure the journal directory exists on disk
    const journalDir = `${this.notesDir}/${journalName}`;
    await this.files.ensureDir(journalDir);

    // Track in preferences (archivedJournals) if not already present
    const archived: Record<string, boolean> =
      (await this.preferences.get("archivedJournals")) ?? {};
    if (!(journalName in archived)) {
      await this.preferences.set(`archivedJournals.${journalName}`, false);
    }
  };

  // probably shouldn't make it to final version
  // Re-test imports by:
  // 1. Delete notes directory
  // 2. Run this command
  // 3. Re-run import
  clearImportTables = async () => {
    await this.db.delete(schema.importNotes);
    await this.db.delete(schema.importFiles);
    await this.db.delete(schema.imports);
  };

  // todo: optionally allow re-importing form a specific import directory by clearing
  // all imports

  // Clear errored or stuck notes so re-import can be attempted; all notes that
  // are not in the 'note_created' state are deleted.
  clearIncomplete = async () => {
    await this.db
      .delete(schema.importNotes)
      .where(ne(schema.importNotes.status, "note_created"));
  };

  // Build both link mappings (sourcePath→dest and title→dest) in a single query.
  private buildLinkMappings = async (importerId: string) => {
    const linkMapping: Record<
      string,
      { journal: string; chroniclesId: string }
    > = {};
    const wikiLinkMapping: Record<
      string,
      { journal: string; chroniclesId: string }
    > = {};

    const importedItems = await this.db
      .select({
        sourcePath: schema.importNotes.sourcePath,
        frontMatter: schema.importNotes.frontMatter,
        journal: schema.importNotes.journal,
        chroniclesId: schema.importNotes.chroniclesId,
        error: schema.importNotes.error,
      })
      .from(schema.importNotes)
      .where(eq(schema.importNotes.importerId, importerId));

    for (const item of importedItems) {
      if (item.error) continue;
      const { journal, chroniclesId, sourcePath } = item;
      linkMapping[sourcePath] = { journal, chroniclesId };
      const title = JSON.parse(item.frontMatter!).title;
      if (title) {
        wikiLinkMapping[title] = { journal, chroniclesId };
      }
    }

    return { linkMapping, wikiLinkMapping };
  };

  private updateNoteLinks = async (
    mdastNode: mdast.Root | mdast.Content,
    item: StagedNote,
    // mapping of sourcePath to new journal and chroniclesId
    linkMapping: Record<string, { journal: string; chroniclesId: string }>,
    // mapping of note title to new journal and chroniclesId
    linkMappingWiki: Record<string, { journal: string; chroniclesId: string }>,
  ) => {
    // todo: update links that point to local files
    if (isNoteLink(mdastNode as mdast.RootContent)) {
      const url = decodeURIComponent((mdastNode as mdast.Link).url);
      const sourceFolderPath = path.dirname(item.sourcePath);
      const sourceUrlResolved = path.resolve(sourceFolderPath, url);
      const mapped = linkMapping[sourceUrlResolved];

      // came up only once in my 400 notes when the linked file did not exist1
      if (!mapped) return;

      (mdastNode as mdast.Link).url =
        `../${mapped.journal}/${mapped.chroniclesId}.md`;
    }

    if (mdastNode.type === "ofmWikilink") {
      const title = (mdastNode as any).value;
      const mapped = linkMappingWiki[title];

      if (!mapped) return;

      // NOTE: This updates the url, but assumes the node type
      // will be converted to regular link in later step
      (mdastNode as any).url = `../${mapped.journal}/${mapped.chroniclesId}.md`;
    }

    if ("children" in mdastNode) {
      for (const child of mdastNode.children as any) {
        this.updateNoteLinks(child, item, linkMapping, linkMappingWiki);
      }
    }
  };

  /**
   * Infer or generate a journal name from the folder path
   *
   * Imported notes have folders, that may be nested and have uique ids in the names
   * and may be invalid names, etc. Handle all that and return or generate a valid name.
   *
   * @param folderPath - The (probably relatiive) path to the folder (we reoslve it to absolute)
   * @param importDir - The root import directory
   * @param journals - A mapping of original folder path to journal name (for cache / unique check)
   *
   * @returns The inferred or generated journal name
   */
  private inferJournalName = (
    // Path to the documents folder, relative to import direcgory
    folderPath: string,
    // import directory, so we can ensure its stripped from the journal name
    importDir: string,
    // cache / unique names checker (for when we have to generate name)
    journals: Record<string, string>,
    sourceType: SourceType,
    category?: string,
  ): string => {
    // In _my_ Notion usage, most of my notes were in a "Documents" database and I
    // used the category to denote the journal name. Very idiosyncratic - if Notion importer
    // is generalized, could make sense to allow specifying a front matter key to use
    // as the journal name. Super overkill though...
    // if a category is provided, use it as the journal name
    try {
      if (category) {
        validateJournalName(category);
        return category;
      }
    } catch (err) {
      console.warn("Unable to use category", category, "as journal name:", err);
    }
    // Notion folder names have unique ids, just like the notes themselves.
    // Also, the folder may be nested, so we need to strip the ids from each
    // ex: "Documents abc123efg"
    // ex: "Documents abc123eft/My Nested Folder hijk456klm"
    const folderNameMaybeNestedWithIds = path
      .resolve(folderPath)
      .split(importDir)[1];

    // if we've already generated a name for this folder, return it; otherwise
    // we'll make a new one (once) and cache it for the next round
    if (folderNameMaybeNestedWithIds in journals) {
      return journals[folderNameMaybeNestedWithIds];
    }

    // Break nested folder into parts, so we can attemp to make a unique journal
    // name from sub-folders (if they exist)
    let nameParts = [];

    if (folderNameMaybeNestedWithIds === "") {
      // no sub-folders, just markdown file(s) in the base import directory
      nameParts = [path.basename(importDir)];
    } else {
      // strip notion ids from each (potential) folder name, then re-assmble
      nameParts = folderNameMaybeNestedWithIds
        // break into parts
        .split(path.sep)
        // if leading with path.sep, kick out ''
        .filter(Boolean)
        .map((part) => {
          // Strip notionId from each part
          // "Documents abc123eft" -> "Documents"
          if (sourceType === SourceType.Notion) {
            const [folderNameWithoutId] = stripNotionIdFromTitle(part);
            return folderNameWithoutId;
          } else {
            return part;
          }
        });
    }

    let journalName = nameParts
      // re-join w/ _ to treat it as a single folder going forward
      .join("_");

    // confirm its valid.
    try {
      try {
        validateJournalName(journalName);
      } catch (err) {
        // try again using only the last part of the name
        journalName = nameParts[nameParts.length - 1]?.slice(
          0,
          MAX_JOURNAL_NAME_LENGTH,
        );
        validateJournalName(journalName);
      }

      // also ensure its unique
      if (Object.values(journals).includes(journalName)) {
        throw new Error(`Journal name ${journalName} not unique`);
      }
    } catch (err) {
      // Generate a new, ugly name; user can decide what they want to do via
      // re-naming later b/c rn its not worth the complexity of doing anything else
      journalName = createId();

      // too long, reserved name, non-unique, etc.
      // known cases from my own import:
      // 1. Note in root import dir, so it had no folder name (todo: use import_dir name)
      console.warn(
        "Error validating journal name",
        nameParts.join(path.sep),
        err,
        "Generating a new name:",
        journalName,
      );
    }

    // cache for next time
    journals[folderNameMaybeNestedWithIds] = journalName;

    return journalName;
  };

  // note: This assumes the mdast.url property of wikiembedding / link is already
  // updated by the updateFileLinks routine.
  private convertWikiLinks = (mdastNode: mdast.Content | mdast.Root) => {
    // todo: also handle ofmWikiLink
    if (mdastNode.type === "ofmWikiembedding") {
      // todo: figure out what to do about hash
      (mdastNode as any).type = "image";
      (mdastNode as any).title = (mdastNode as any).value;
      (mdastNode as any).alt = (mdastNode as any).value;
      // url is already set by updateFileLinks
    } else if (mdastNode.type === "ofmWikilink") {
      (mdastNode as any).children = [
        { type: "text", value: (mdastNode as any).value },
      ];
      (mdastNode as any).type = "link";
    } else {
      if ("children" in mdastNode) {
        for (const child of mdastNode.children as any) {
          this.convertWikiLinks(child);
        }
      }
    }
  };

  // 1. Find and collect all ofmTags, so they can be added to front matter
  // 2. Convert ofmTags to text nodes otherwise later Slate will choke on them, since
  // Chronicles does not (yet) natively support inline tags
  // todo(test): Tag with #hash remains in document; tag without hash is stored in db
  private processAndConvertTags = (
    mdastNode: mdast.Content | mdast.Root,
    tags: string[] = [],
  ): string[] => {
    if (mdastNode.type === "ofmTag") {
      (mdastNode as any).type = "text";
      const tag = (mdastNode as any).value; // without hash
      (mdastNode as any).value = `#${(mdastNode as any).value}`;
      tags.push(tag);
      return tags;
    } else {
      if ("children" in mdastNode) {
        for (const child of mdastNode.children as any[]) {
          this.processAndConvertTags(child, tags);
        }
      }

      return tags;
    }
  };
}
