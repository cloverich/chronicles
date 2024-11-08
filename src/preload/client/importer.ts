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

import { uuidv7obj } from "uuidv7";
import { mdastToString, stringToMdast } from "../../markdown";
import { parseTitleAndFrontMatter } from "./importer/frontmatter";

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

// Note as staged in the import_notes table
interface StagedNote {
  // where the note comes from
  importerId: string;
  sourcePath: string;
  sourceId?: string;

  // may be empty if could not parse body
  // correctly
  journal: string;
  title: string;
  content: string;
  frontMatter: string; // json

  // Where this note will end up
  chroniclesId: string;
  chroniclesPath: string;
  status: string; // 'pending' | 'note_created'
  error: string | null;
}

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

  /**
   * Imports importDir into the chronicles root directory, grabbing all markdown
   * and linked files; makes the following changes:
   * - Moves all markdown files to the chronicles root directory
   * - Flattents to one-directory deep and updates links
   * - Re-names all files to use a unique ID for their name
   * - Copies all referenced files to the _attachments directory
   *
   * Designed for my own Notion export, and assumes sync will be called afterwards.
   */
  import = async (importDir: string) => {
    await this.clearImportTables();
    const importerId = uuidv7obj().toHex();
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
      await this.knex("imports").insert({
        id: importerId,
        status: "pending",
        importDir,
      });
    } catch (err) {
      console.error("Error saving import", importerId, importDir, err);
      throw err;
    }

    console.log("importing directory", importDir);
    await this.stageNotes(importDir, importerId, chroniclesRoot);
    await this.processStagedNotes(chroniclesRoot);
  };

  // stage all notes and files in the import directory for processing.
  // we do this in two steps so we can generate mappings of source -> dest
  // for links and files, and then update them in the second pass.
  private stageNotes = async (
    importDir: string,
    importerId: string,
    chroniclesRoot: string, // absolute path to chronicles root dir
  ) => {
    // for processNote; maps the original folder path to the fixed name
    const journalsMapping: Record<string, string> = {};

    for await (const file of Files.walk(importDir, () => true, {})) {
      await this.stageNote(file, importDir, importerId, journalsMapping);
    }
  };

  // stage a single note for processing
  private stageNote = async (
    file: PathStatsFile,
    importDir: string,
    importerId: string,
    journals: Record<string, string>, // mapping of original folder path to journal name
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
      const journalName = this.inferJournalName(
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

      const mdast = stringToMdast(body);

      await this.stageNoteFiles(importerId, importDir, file.path, mdast);

      const chroniclesId = uuidv7obj().toHex();
      const importItem = {
        importerId,
        chroniclesId: chroniclesId,
        // hmm... what am I going to do with this? Should it be absolute to NOTES_DIR?
        chroniclesPath: `${path.join(journalName, chroniclesId)}.md`,
        sourceId: notionId,
        sourcePath: file.path,
        title,
        content: body,
        journal: journalName,
        frontMatter: JSON.stringify(frontMatter),
        status: "pending",
      };

      await this.knex("import_notes").insert(importItem);
    } catch (e) {
      // todo: this error handler is far too big, obviously
      console.error("Error processing note", file.path, e);
    }
  };

  // Second pass; process all staged notes and files
  private processStagedNotes = async (chroniclesRoot: string) => {
    await this.ensureRoot();
    const { id: importerId, importDir } = await this.knex("imports")
      .where({
        status: "pending",
      })
      .first();

    if (!importerId) {
      console.log("No pending imports");
      return;
    } else {
      console.log("Processing import", importerId, importDir);
    }

    await this.moveStagedFiles(chroniclesRoot, importerId, importDir);
    const filesMapping = await this.movedFilePaths(importerId);
    const linkMapping = await this.noteLinksMapping(importerId);

    const items = await this.knex<StagedNote>("import_notes").where({
      importerId,
    });

    for await (const item of items) {
      const frontMatter = JSON.parse(item.frontMatter);

      // todo: can I store the mdast in JSON? If so, should I just do this on the first
      // pass since I already parsed it to mdast once?
      const mdast = stringToMdast(item.content) as any as mdast.Root;
      this.updateNoteLinks(mdast, item, linkMapping);

      // chris: if item.sourcePath isn't the same sourcePath used to make the file link the first
      // time maybe wont be right. I changed a lot of code without testing yet.
      this.updateFileLinks(item.sourcePath, mdast, filesMapping);

      // with updated links we can now save the document
      try {
        const [id, docPath] = await this.documents.createDocument(
          {
            id: item.chroniclesId,
            journal: item.journal, // using name as id
            content: mdastToString(mdast),
            title: item.title, //stripNotionIdFromTitle(name),
            tags: frontMatter.tags || [],
            createdAt: frontMatter.createdAt,
            updatedAt: frontMatter.updatedAt,
          },
          false, // don't index; we'll call sync after import
        );

        await this.knex<StagedNote>("import_notes")
          .where({ importerId: item.importerId, sourcePath: item.sourcePath })
          .update({ status: "note_created", error: null });
      } catch (err: any) {
        await this.knex<StagedNote>("import_notes")
          .where({ importerId: item.importerId, sourcePath: item.sourcePath })
          .update({ status: "note_created", error: err.message });
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
    const { error_count } = (await this.knex("import_notes")
      .where({ importerId })
      .whereIn("status", ["processing_error", "create_error"])
      .count({ error_count: "*" })
      .first())!;

    console.log("import completed; errors count:", error_count);
    if (!error_count) {
      await this.knex("imports")
        .where({ id: importerId })
        .update({ status: "complete" });
    }

    console.log("import complete; calling sync to update indexes");

    await this.syncs.sync();
  };

  // probably shouldn't make it to final version
  // Re-test imports by:
  // 1. Delete notes directory
  // 2. Run this command
  // 3. Re-run import
  private clearImportTables = async () => {
    await this.db.exec("DELETE FROM import_notes");
    await this.db.exec("DELETE FROM import_files");
    await this.db.exec("DELETE FROM imports");
  };

  // Pull all staged notes and generate a mapping of original file path
  // (sourcePath) to the new file path (chroniclesPath). This is used to update
  // links in the notes after they are moved.
  private noteLinksMapping = async (importerId: string) => {
    let linkMapping: Record<string, { journal: string; chroniclesId: string }> =
      {};

    const importedItems = await this.knex("import_notes")
      .where({ importerId })
      .select("sourcePath", "journal", "chroniclesId");

    for (const item of importedItems) {
      if ("error" in item && item.error) continue;
      const { journal, chroniclesId, sourcePath } = item;
      linkMapping[sourcePath] = { journal, chroniclesId };
    }

    return linkMapping;
  };

  // check if a markdown link is a link to a (markdown) note
  private isNoteLink = (url: string) => {
    // we are only interested in markdown links
    if (!url.endsWith(".md")) return false;

    // ensure its not a url with an .md domain
    if (url.includes("://")) return false;

    return true;
  };

  private updateNoteLinks = async (
    mdast: mdast.Root | mdast.Content,
    item: StagedNote,
    linkMapping: Record<string, { journal: string; chroniclesId: string }>,
  ) => {
    if (mdast.type === "link" && this.isNoteLink(mdast.url)) {
      const url = decodeURIComponent(mdast.url);
      const sourceFolderPath = path.dirname(item.sourcePath);
      const sourceUrlResolved = path.resolve(sourceFolderPath, url);
      const mapped = linkMapping[sourceUrlResolved];

      // came up only once in my 400 notes when the linked file did not exist1
      if (!mapped) return;

      mdast.url = `../${mapped.journal}/${mapped.chroniclesId}.md`;
    }

    if ("children" in mdast) {
      for (const child of mdast.children) {
        this.updateNoteLinks(child, item, linkMapping);
      }
    }
  };

  private ensureRoot = async () => {
    const chroniclesRoot = await this.preferences.get("NOTES_DIR");

    // Sanity check this is set first, because I'm hacking a lot of stuff together
    // in tiny increments, many things bound to get mixed up
    if (!chroniclesRoot || typeof chroniclesRoot !== "string") {
      throw new Error("No chronicles root directory set");
    }

    return chroniclesRoot;
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
      journalName = uuidv7obj().toHex();

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

  // Everything but copy file from validateAndMoveFile,
  // return generated ID and dest filelname and whether it was resolved,
  // store this in staging table in stageFile.
  private fileExists = async (
    resolvedPath: string,
    importDir: string,
  ): Promise<[null, string] | [string, null]> => {
    // Check if file is contained within importDir to prevent path traversal
    if (!resolvedPath.startsWith(importDir))
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

    return [resolvedPath, null];
  };

  // Because I keep forgetting extension already has a . in it, etc.
  // Returns relative or absolute path based which one attachmentsPath
  // Chronicles file references are always ../_attachments/chroniclesId.ext as
  // of this writing.
  private makeDestinationFilePath = (
    attachmentsPath: string,
    chroniclesId: string,
    extension: string,
  ) => {
    return path.join(attachmentsPath, `${chroniclesId}${extension}`);
  };

  // Mdast helper to determine if a node is a file link
  isFileLink = (
    mdast: mdast.Content | mdast.Root,
  ): mdast is mdast.Image | mdast.Link => {
    return (
      (mdast.type === "image" || mdast.type === "link") &&
      !this.isNoteLink(mdast.url) &&
      !/^(https?|mailto|#|\/|\.|tel|sms|geo|data):/.test(mdast.url)
    );
  };

  /**
   * Resolve a file link to an absolute path, which we use as the primary key
   * in the staging table for moving files; can be used to check if file was
   * already moved, and to fetch the destination id for the link when updating
   * the link in the document.
   *
   * @param noteSourcePath - absolute path to the note that contains the link
   * @param url - mdast.url of the link
   */
  private cleanFileUrl = (noteSourcePath: string, url: string): string => {
    const urlWithoutQuery = url.split(/\?/)[0] || "";
    return decodeURIComponent(
      // todo: should we also normalize here?
      path.normalize(
        path.resolve(path.dirname(noteSourcePath), urlWithoutQuery),
      ),
    );
  };

  // Sanitize the url and stage it into the import_files table
  private stageFile = async (
    importerId: string,
    url: string, // mdast.url of the link
    noteSourcePath: string, // path to the note that contains the link
    // Might need this if we validate before staging
    importDir: string, // absolute path to import directory
  ) => {
    const resolvedUrl = this.cleanFileUrl(noteSourcePath, url);

    // todo: sourcePathResolved is the primary key; should be unique; but we don't need to error
    // here if it fails to insert; we can skip because we only need to stage and move it once
    // IDK what the error signature here is.
    try {
      await this.knex("import_files").insert({
        importerId: importerId,
        sourcePathResolved: resolvedUrl,
        chroniclesId: uuidv7obj().toHex(),
        extension: path.extname(resolvedUrl),
      });
    } catch (err: any) {
      // file referenced more than once in note, or in more than one notes; if import logic
      // is good really dont even need to log this, should just skip
      if ("code" in err && err.code === "SQLITE_CONSTRAINT_PRIMARYKEY") {
        console.log("skipping file already staged", resolvedUrl);
      } else {
        throw err;
      }
    }
  };

  // Move all staged files to _attachments (if pending)
  private moveStagedFiles = async (
    chroniclesRoot: string,
    importerId: string,
    importDir: string,
  ) => {
    const files = await this.knex("import_files").where({
      importerId,
      status: "pending",
    });

    const attachmentsDir = path.join(chroniclesRoot, "_attachments");
    await fs.promises.mkdir(attachmentsDir, { recursive: true });

    for await (const file of files) {
      const { sourcePathResolved, extension, chroniclesId } = file;

      // todo: convert to just err checking
      let [_, err] = await this.fileExists(sourcePathResolved, importDir);

      if (err != null) {
        console.error("this.fileExists test fails for ", sourcePathResolved);
        await this.knex("import_files")
          .where({ importerId, sourcePathResolved })
          .update({ error: err });
        continue;
      }

      const destinationFile = this.makeDestinationFilePath(
        attachmentsDir,
        chroniclesId,
        extension,
      );

      try {
        await this.files.copyFile(sourcePathResolved, destinationFile);
      } catch (err) {
        await this.knex("import_files")
          .where({ importerId, sourcePathResolved })
          .update({ error: (err as Error).message });
        continue;
      }

      await this.knex("import_files")
        .where({ importerId, sourcePathResolved })
        .update({ status: "complete" });
    }
  };

  // Fetch all files  successfully moved to _attachments, and return a mapping
  // of the original source path to the new filename so document file links can be updated
  private movedFilePaths = async (importerId: string) => {
    const files = await this.knex("import_files").where({
      importerId,
      status: "complete",
    });

    // todo: Can pass in chronicles root; but since convention is always ../_attachments/file, should
    // always be able to re-construct this...
    const mapping: Record<string, string> = {};
    for (const file of files) {
      mapping[file.sourcePathResolved] = this.makeDestinationFilePath(
        "../_attachments",
        file.chroniclesId,
        file.extension,
      );
    }

    return mapping;
  };

  /**
   * For each link in the file that points to a file, move the file to _attachments,
   * rename the file based on chronicles conventions, and update the link in the file.
   *
   * @param importDir - The root import directory\
   * @param sourcePath - The path to the source file that contains the link; used to resolve relative links
   * @param mdast
   */
  private stageNoteFiles = async (
    importerId: string,
    importDir: string,
    sourcePath: string,
    mdast: mdast.Content | mdast.Root,
  ): Promise<void> => {
    if (this.isFileLink(mdast)) {
      await this.stageFile(importerId, mdast.url, sourcePath, importDir);
    } else {
      if ("children" in mdast) {
        let results = [];
        for await (const child of mdast.children) {
          await this.stageNoteFiles(importerId, importDir, sourcePath, child);
        }
      }
    }
  };

  // use the mapping of moved files to update the file links in the note
  private updateFileLinks = (
    noteSourcePath: string,
    mdast: mdast.Content | mdast.Root,
    filesMapping: Record<string, string>,
  ) => {
    if (this.isFileLink(mdast)) {
      const url = this.cleanFileUrl(noteSourcePath, mdast.url);
      if (url in filesMapping) {
        mdast.url = filesMapping[url];
      }
    } else {
      if ("children" in mdast) {
        for (const child of mdast.children) {
          this.updateFileLinks(noteSourcePath, child, filesMapping);
        }
      }
    }
  };
}
