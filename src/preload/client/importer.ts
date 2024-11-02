import { Database } from "better-sqlite3";
import fs from "fs";
import { Knex } from "knex";
import path from "path";
import { Files, PathStatsFile } from "../files";
import { IDocumentsClient } from "./documents";
import { IFilesClient } from "./files";
import {
  IJournalsClient,
  MAX_NAME_LENGTH as MAX_JOURNAL_NAME_LENGTH,
  validateJournalName,
} from "./journals";
import { IPreferencesClient } from "./preferences";
import { ISyncClient } from "./sync";

// todo: this is a dumb way to do this.. see how ts-mdast is exported
import * as mdast from "../../markdown/remark-slate-transformer/models/mdast";

export type IImporterClient = ImporterClient;

import { uuidv7 } from "uuidv7";
import { mdastToString, stringToMdast } from "../../markdown";
import { parseTitleAndFrontMatter } from "./importer/frontmatter";

// naive regex for matching uuidv7, for checking filenames match the format
const uuidv7Regex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SKIPPABLE_FILES = new Set(".DS_Store");

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

interface ImportItemSuccess {
  importerId: string;
  sourcePath: string;
  sourceId?: string;

  title: string;
  journal: string;
  content: string;
  frontMatter: string;

  // Where this item will end up
  chroniclesId: string;
  chroniclesPath: string;
  status: string; // 'pending' | 'complete' | 'error'
}

interface ImportItemError {
  importerId: string;
  title: string;
  journal: string;
  sourcePath: string;
  sourceId?: string;

  // error specific
  status: "error";
  error: true;
}

type ImportItem = ImportItemSuccess | ImportItemError;

// ugh, when pulling from db we get full set of propeties so my interfaces
// above dont' make sense; need to re-think this
type ImportItemDb = {
  importerId: string;
  sourcePath: string;
  sourceId?: string;

  title: string;
  journal: string;
  content: string;
  frontMatter: string;

  // Where this item will end up
  chroniclesId: string;
  chroniclesPath: string;
  status: string; // 'pending' | 'complete' | 'error'
};

/**
 * For processing links, we pass through documents multiple times. First,
 * we collect all the links, including their source document name and path.
 * Then, we annotate with the chronicles id and path (that it will eventually have)
 * and the journal name. In this way, we can re-name links on the second pass
 * to point to the correct (updated) path, before we save the document. Because
 * we do this before we save, there is some risk it won't be right.
 */
interface ImportItemLink {
  kind: "link" | "file";
  importerId: string;
  sourceChroniclesId: string; // chronicles id of document that owns the link
  sourceChroniclesPath: string; // path of document that contains the link
  sourceId?: string;
  sourceUrl: string;
  title: string;
  journal: string;

  destChroniclesId: string; // chronicles id of document this link points to

  // todo: Maybe make this sourceUrlResolved (i.e. the path with decoded id)
  sourceUrlResolved: string;
  sourceUrlResolveable: number; // boolean
}

const importedItems: ImportItem[] = [];

export class ImporterClient {
  constructor(
    private db: Database,
    private knex: Knex,
    private journals: IJournalsClient,
    private documents: IDocumentsClient,
    private files: IFilesClient,
    private preferences: IPreferencesClient,
    private syncs: ISyncClient, // sync is keyword?
  ) {}

  // probably shouldn't make it to final version
  // Re-test imports by:
  // 1. Delete notes directory
  // 2. Run this command
  // 3. Re-run import
  clearImportTables = async () => {
    await this.db.exec("DELETE FROM import_items");
    await this.db.exec("DELETE FROM import_links");
    await this.db.exec("DELETE FROM imports");
  };

  saveImportItem = async (item: ImportItem) => {
    // inserts into the import_items table
    try {
      if ("error" in item) {
        this.db
          .prepare(
            `INSERT INTO import_items (
              importerId, 
              title,
              journal,
              sourcePath, 
              sourceId, 
              error, 
              status)
            VALUES (
              :importerId, 
              :title, 
              :journal, 
              :sourcePath, 
              :sourceId, 
              :error, 
              :status)`,
          )
          .run(item);
      }
      this.db
        .prepare(
          `INSERT INTO import_items (importerId, title, journal, 
              content,
              frontMatter, chroniclesId, chroniclesPath, sourcePath, sourceId, status)
      VALUES (:importerId, :title, :journal, 
              :content,
              :frontMatter, :chroniclesId, :chroniclesPath, :sourcePath, :sourceId, :status)`,
        )
        .run(item);
    } catch (err) {
      console.error("Error saving import item", item, err);
    }
  };

  updateImportItemStatus = async (
    item: ImportItem,
    status: string,
    error?: string,
  ) => {
    try {
      // todo: knex...
      if ("error" in item) {
        this.db
          .prepare(
            `UPDATE import_items SET status = :status, error = :error WHERE importerId = :importerId AND sourcePath = :sourcePath`,
          )
          .run({
            importerId: item.importerId,
            sourcePath: item.sourcePath,
            status,
            error,
          });
        return;
      } else {
        this.db
          .prepare(
            `UPDATE import_items SET status = :status WHERE importerId = :importerId AND sourcePath = :sourcePath`,
          )
          .run({
            importerId: item.importerId,
            sourcePath: item.sourcePath,
            status,
          });
      }
    } catch (err) {
      console.error("Error updating import item status", item, err);
    }
  };

  saveImportItemLinks = async (items: ImportItemLink[]) => {
    try {
      items.forEach((item) => {
        this.db
          .prepare(
            `INSERT INTO import_links (importerId, sourceChroniclesId, sourceId, title, journal, sourceChroniclesPath, sourceUrl, kind, sourceUrlResolved, sourceUrlResolveable)
          VALUES (:importerId, :sourceChroniclesId, :sourceId, :title, :journal, :sourceChroniclesPath, :sourceUrl, :kind, :sourceUrlResolved, :sourceUrlResolveable)`,
          )
          .run(item);
      });
    } catch (err: any) {
      // already exists -- acceptable!
      if (err?.code === "SQLITE_CONSTRAINT_PRIMARYKEY") return;

      console.error("Error saving import links", items, err);
    }
  };

  stageImportItems = async (
    importDir: string,
    importerId: string,
    chroniclesRoot: string, // absolute path to chronicles root dir
  ) => {
    // for processNote; maps the original folder path to the fixed name
    const journalsMapping: Record<string, string> = {};
    const filesMapping: Record<string, string> = {};

    for await (const file of Files.walk(importDir, () => true, {
      // depth: dont go into subdirectories
      // depthLimit: 1,
    })) {
      await this.stageNote(
        file,
        importDir,
        importerId,
        journalsMapping,
        filesMapping,
        chroniclesRoot,
      );
    }
  };

  extractAndUpdateLinks = async (
    mdast: mdast.Root,
    item: ImportItemDb,
    linkMapping: Record<string, { journal: string; chroniclesId: string }>,
  ) => {
    const links = this.selectLinks(mdast);
    if (!links.size) return;

    // todo: pre-build this mapping from the database, we already have all of this information
    // there.
    const mappedLinks: Record<string, string> = {};

    for (const link of Array.from(links)) {
      const sourceFolderPath = path.dirname(item.sourcePath);
      const sourceUrlResolved = path.resolve(sourceFolderPath, link.url);
      const mapped = linkMapping[sourceUrlResolved];
      if (!mapped) {
        // NOTE: This came up only when referenced url (md file) was not found
        // in the import dir; this is tracked as sourceUrlResolveable = false
        // already; can pick up there if I need to better support this.
        // Until then, just let the link be invalid in the source document.
        // console.error("no mapping for", sourceUrlResolved);
        continue;
      }
      mappedLinks[link.url] = `../${mapped.journal}/${mapped.chroniclesId}.md`;
    }

    this.updateLinks(mdast, mappedLinks);
  };

  ensureRoot = async () => {
    const chroniclesRoot = await this.preferences.get("NOTES_DIR");

    // Sanity check this is set first, because I'm hacking a lot of stuff together
    // in tiny increments, many things bound to get mixed up
    if (!chroniclesRoot || typeof chroniclesRoot !== "string") {
      throw new Error("No chronicles root directory set");
    }

    return chroniclesRoot;
  };

  /**
   * Sync the notes directory with the database
   */
  import = async (importDir: string) => {
    await this.clearImportTables();
    const importerId = uuidv7();
    const chroniclesRoot = await this.ensureRoot();

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
      this.db
        .prepare(
          "INSERT INTO imports (id, status, importDir) VALUES (:id, :status, :importDir)",
        )
        .run({
          id: importerId,
          status: "pending",
          importDir: importDir,
        });
    } catch (err) {
      console.error("Error saving import", importerId, importDir, err);
      throw err;
    }

    console.log("importing directory", importDir);
    await this.stageImportItems(importDir, importerId, chroniclesRoot);
    await this.processStagedItems();
  };

  processStagedItems = async () => {
    await this.ensureRoot();
    const { id: importerId, importDir } = this.db
      .prepare(
        "select id, importDir from imports where status = 'pending' order by id desc limit 1",
      )
      .get();

    if (!importerId) {
      console.log("No pending imports");
      return;
    } else {
      console.log("Processing import", importerId, importDir);
    }

    const items: ImportItemDb[] = await this.db
      .prepare("select * from import_items where importerId = :importerId")
      .all({ importerId });

    // Links point to the original documents path (sourcePath). Build a mapping
    // of each document's sourcePath to its eventual Chronicles path (journal/chroniclesId.md)
    // With this, we can update links in each document.
    const linkMapping: Record<
      string,
      { journal: string; chroniclesId: string }
    > = {};

    const allItems = await this.db
      .prepare("select journal,chroniclesId,sourcePath from import_items")
      .all();

    for (const item of allItems) {
      if ("error" in item && item.error) continue;
      const { journal, chroniclesId, sourcePath } = item;
      linkMapping[sourcePath] = { journal, chroniclesId };
    }

    for await (const item of items) {
      // todo: This is actually a staging error
      // should set this while staging the item, and
      // then not fetch it here.
      if ("error" in item && item.error) {
        await this.updateImportItemStatus(item, "processing_error");
        console.log("skipping error item", item.sourcePath);
        continue;
      }

      const frontMatter = JSON.parse(item.frontMatter);

      // todo: can I store the mdast in JSON? If so, should I just do this on the first
      // pass since I already parsed it to mdast once?
      const mdast = stringToMdast(item.content) as any as mdast.Root;
      this.extractAndUpdateLinks(mdast, item, linkMapping);

      // with updated links we can now save the document
      try {
        const [id, docPath] = await this.documents.createDocument(
          {
            id: item.chroniclesId,
            journal: item.journal, // using name as id

            // todo: wrap stringifying these errors separately; maybe updateLinks should return the content|error error separately
            content: mdastToString(mdast),
            title: item.title, //stripNotionIdFromTitle(name),
            tags: frontMatter.tags || [],
            createdAt: frontMatter.createdAt,
            updatedAt: frontMatter.updatedAt,
          },
          false, // don't index; we'll call sync after import
        );
        await this.updateImportItemStatus(item, "document_created");
      } catch (err) {
        await this.updateImportItemStatus(item, "create_error");
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
    const { error_count } = await this.db
      .prepare(
        "select count(*) as error_count from import_items where importerId = :importerId and status in ('processing_error', 'create_error')",
      )
      .get({ importerId });

    console.log("import completed; errors count:", error_count);
    if (!error_count) {
      await this.db
        .prepare("UPDATE imports SET status = 'complete' WHERE id = :id")
        .run({ id: importerId });
    }

    console.log("import complete; calling sync to update indexes");
    await this.syncs.sync();
  };

  private isNoteLink = (url: string) => {
    // we are only interested in markdown links
    if (!url.endsWith(".md")) return false;

    // ensure its not a url with an .md domain
    if (url.includes("://")) return false;

    return true;
  };

  /**
   * Update the links in a document with the provided mapping
   * @param mdast - contents parsed to MDAST
   * @param links  - Mapping of (cleaned) original link to updated link
   */
  private updateLinks = (
    mdast: mdast.Content | mdast.Root,
    links: Record<string, string>,
  ) => {
    if (mdast.type === "link" && this.isNoteLink(mdast.url)) {
      // todo: I do this in the other routine too sigh, so links has it stored this way
      // fucking hell.
      const url = decodeURIComponent(mdast.url);
      if (!(url in links)) {
        // After testing, this was only when the linked file did not exist; this is already tracked
        // On the import item link as sourceUrlResolveable = false so; pick up there if
        // I need to better support this.
        // Until then, just let the link be invalid in the source document.
        // throw new Error("link not found");
      } else {
        mdast.url = links[url];
      }
    }

    if ("children" in mdast) {
      for (const child of mdast.children) {
        this.updateLinks(child, links);
      }
    }
  };

  /**
   * Grab all links from the note
   */
  private selectLinks = (
    mdast: mdast.Content | mdast.Root,
    // todo: no longer need set since moving to object, re-work this
    links: Set<{
      title: string;
      url: string;
      description?: string;
    }> = new Set(),
  ) => {
    if (mdast.type === "link") {
      if (!this.isNoteLink(mdast.url)) return links;

      links.add({
        // Notion's filenames are url encoded; the urls are url encoded
        // When _i_ parse the file (fs.stat in Files.walk), they are coming
        // back as decoded (e.g. %20 -> " "). So decode before saving. Need
        // to test this and ensure it is consistent across platforms (eventually);
        // need to test this with tests to ensure it works as expected
        // need to validate against my own notes which I should be able to do easily
        // i.e. how many resolve properly
        url: decodeURIComponent(mdast.url),
        // todo: error handling for mdastToString
        title:
          // trim: trailing \n added by stringifier
          mdastToString({ type: "root", children: mdast.children })?.trim() ||
          mdast.url,
        description: undefined, // undefined on links, not files
      });
    }

    if ("children" in mdast) {
      for (const child of mdast.children) {
        this.selectLinks(child, links);
      }
    }

    return links;
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
  private inferOrGenerateJournalName = (
    // Path to the documents folder, relative to import direcgory
    folderPath: string,
    // import directory, so we can ensure its stripped from the journal name
    importDir: string,
    // cache / unique names checker (for when we have to generate name)
    journals: Record<string, string>,
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
        // Strip notionId from each part
        // "Documents abc123eft" -> "Documents"
        .map((part) => {
          const [folderNameWithoutId] = stripNotionIdFromTitle(part);
          return folderNameWithoutId;
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
      journalName = uuidv7();

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

  /**
   * For files (images, etc., not markdown links) found in a note, move them to the
   * ensure they are valid, then rename them, and move to _attachments directory
   * in the chronicles root.
   *
   * @param sourcePath - relative path to source file
   * @param destinationDir - absolute path to destination directory
   * @param importDir - absolute path to import directory
   * @returns
   */
  private validateAndMoveFile = async (
    resolvedPath: string,
    destinationDir: string,
    importDir: string,
  ): Promise<[string, null] | [null, string]> => {
    // sourcePath = decodeURIComponent(sourcePath);

    const sanitizedPath = path.normalize(resolvedPath);

    // Check if file is contained within importDir to prevent path traversal
    if (!sanitizedPath.startsWith(importDir))
      return [null, "Potential path traversal detected"];

    // Check if the file exists
    if (!fs.existsSync(resolvedPath))
      return [null, "Source file does not exist"];

    // Check if file has read permissions
    try {
      await fs.promises.access(resolvedPath, fs.constants.R_OK);
    } catch {
      return [null, "No read access to the file"];
    }

    // Generate a unique destination filename in _attachments
    const ext = path.extname(sanitizedPath);
    const destFile = path.join(destinationDir, `${uuidv7()}${ext}`);

    // Ensure destination directory exists
    await fs.promises.mkdir(path.dirname(destFile), { recursive: true });

    // Move the file and return destination filename or error
    try {
      await this.files.copyFile(resolvedPath, destFile);
      const destFileName = path.basename(destFile);
      return [destFileName, null];
    } catch (err) {
      return [null, `Error moving file: ${(err as Error).message}`];
    }
  };

  /**
   * Mdast helper to determine if a node is a file link
   * @param mdast
   * @returns
   */
  private isFileLink = (
    mdast: mdast.Content | mdast.Root,
  ): mdast is mdast.Image | mdast.Link => {
    return (
      (mdast.type === "image" || mdast.type === "link") &&
      !this.isNoteLink(mdast.url) &&
      !/^(https?|mailto|#|\/|\.|tel|sms|geo|data):/.test(mdast.url)
    );
  };

  /**
   * When moving files into _attachments, first check if the file has already been moved
   * (in the cache); if not move it (and update cache). Return the new filename
   * if the file was moved successfully; null if there was an error (and log it)
   */
  private findOrMoveFile = async (
    importDir: string,
    resolvedPath: string, // abs path to document the file link is from
    cache: Record<string, string>,
    attachmentsDir: string, // absolute path to destination _attachments dir
  ) => {
    if (!(resolvedPath in cache)) {
      const [filename, err] = await this.validateAndMoveFile(
        resolvedPath,
        attachmentsDir,
        importDir,
      );

      if (err) {
        console.error("Error moving file", resolvedPath, err);
        return;
      }

      // console.info("updating link", resolvedPath, "->", filename);
      cache[resolvedPath] = filename!;
    }

    return cache[resolvedPath];
  };

  /**
   * For each link in the file that points to a file, move the file to _attachments,
   * rename the file based on chronicles conventions, and update the link in the file.
   *
   * @param importDir - The root import directory\
   * @param sourcePath - The path to the source file that contains the link; used to resolve relative links
   * @param mdast
   * @param cache
   * @param attachmentsDir - The absolute path to the _attachments directory
   */
  private moveAndUpdateFileLinks = async (
    importDir: string,
    sourcePath: string,
    mdast: mdast.Content | mdast.Root,
    cache: Record<string, string>,
    attachmentsDir: string, // absolute path to _attachments
    didMove = false,
    // todo: return boolean for debugging, either stuff into import_items,
    // or... cache technically has all this info...
    // todo(2): track these as import item links because it simplifies debugging
    // etc.
  ): Promise<boolean> => {
    if (this.isFileLink(mdast)) {
      // convert url to absolute path
      const resolvedUrl = decodeURIComponent(
        path.resolve(path.dirname(sourcePath), mdast.url?.split(/\?/)[0] || ""),
      );

      const filename = await this.findOrMoveFile(
        importDir,
        resolvedUrl,
        cache,
        attachmentsDir,
      );
      if (filename) {
        // todo: stage and save the import item
        mdast.url = `../_attachments/${filename}`;
        return true;
      }
      return false;
    } else {
      if ("children" in mdast) {
        let results = [];
        for (const child of mdast.children) {
          results.push(
            await this.moveAndUpdateFileLinks(
              importDir,
              sourcePath,
              child,
              cache,
              attachmentsDir,
              didMove,
            ),
          );
        }

        return results.some((result) => result);
      }

      return false;
    }
  };

  private stageNote = async (
    file: PathStatsFile,
    importDir: string,
    importerId: string,
    journals: Record<string, string>, // mapping of original folder path to journal name
    filesMapping: Record<string, string>, // mapping of original file path to chronicles path
    chroniclesRoot: string,
  ) => {
    const { ext, name, dir } = path.parse(file.path);

    // Skip hidden files and directories
    if (name.startsWith(".")) return;
    if (SKIPPABLE_FILES.has(name)) return;

    // Skip directories, symbolic links, etc.
    if (!file.stats.isFile()) return;

    // Only process markdown files
    if (ext !== ".md") return;

    // todo: handle repeat import, specifically if the imported folder / file already exists;
    // b/c that may happen when importing multiple sources...

    // todo: sha comparison
    const contents = await Files.read(file.path);
    const [, notionId] = stripNotionIdFromTitle(name);

    try {
      // todo: fallback title to filename - uuid
      const { frontMatter, body, title } = parseTitleAndFrontMatter(contents);
      const journalName = this.inferOrGenerateJournalName(
        dir,
        importDir,
        journals,
        // See notes in inferOrGenerateJournalName; this is a very specific
        // to my Notion export.
        frontMatter.Category,
      );

      // In a directory that was pre-formatted by Chronicles, this should not
      // be needed. Will leave here as a reminder when I do the more generalized
      // import routine.
      if (!frontMatter.createdAt) {
        frontMatter.createdAt = file.stats.ctime.toISOString();
      }

      // todo: check updatedAt Updated At, Last Edited, etc.
      // createdAt
      if (!frontMatter.updatedAt) {
        frontMatter.updatedAt = file.stats.mtime.toISOString();
      }

      // todo: handle additional kinds of frontMatter; just add a column for them
      // and ensure they are not overwritten when editing existing files
      // https://github.com/cloverich/chronicles/issues/127

      // Files: move to _attachments, update links; must happen before we stage
      // import item so we can use the updated markdown content
      const mdast = stringToMdast(body) as any as mdast.Root;

      const attachmentsDir = path.join(chroniclesRoot, "_attachments");
      const moved = await this.moveAndUpdateFileLinks(
        importDir,
        file.path,
        mdast,
        filesMapping,
        attachmentsDir,
      );

      const chroniclesId = uuidv7();
      const importItem = {
        importerId,
        chroniclesId: chroniclesId,
        // hmm... what am I going to do with this? Should it be absolute to NOTES_DIR?
        chroniclesPath: `${path.join(journalName, chroniclesId)}.md`,
        sourceId: notionId,
        sourcePath: file.path,
        title,
        journal: journalName,
        content: mdastToString(mdast),
        frontMatter: JSON.stringify(frontMatter),
        status: "pending",
      };

      this.saveImportItem(importItem);

      // todo: Unlike sync, here we need to handle images and note references
      // there are two kinds of note references: file references, and [[Magic References]], the latter
      // only exist in Obsidian, and a few other note apps, not in Notion. So we can ignore them for now.

      // stage links for later processing
      const linkItems: ImportItemLink[] = [];
      const links = this.selectLinks(mdast);
      for (const link of links) {
        const sourceFolderPath = path.dirname(file.path);
        const sourceUrlResolved = path.resolve(sourceFolderPath, link.url);
        const canAccessFile = await this.files.validFile(
          sourceUrlResolved,
          false,
        );

        linkItems.push({
          importerId,
          sourceChroniclesId: importItem.chroniclesId,
          sourceChroniclesPath: importItem.chroniclesPath,
          sourceId: notionId,
          sourceUrl: link.url,

          // sourceUrlResolvedToTheFullTargetPath
          sourceUrlResolved: sourceUrlResolved,
          destChroniclesId: "", // todo: fill this in later
          // todo: Uh re-name this "Accessable" or something
          sourceUrlResolveable: canAccessFile ? 1 : 0,
          kind: "link",
          title: link.title,
          journal: journalName,
        });
      }

      await this.saveImportItemLinks(linkItems);
      return;
    } catch (e) {
      // todo: this error handler is far too big, obviously
      console.error("Error processing note", file.path, e);
      return;
    }
  };
}
