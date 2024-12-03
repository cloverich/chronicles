import fs from "fs";
import { Knex } from "knex";
import mdast from "mdast";
import path from "path";
import { uuidv7obj } from "uuidv7";
import { PathStatsFile } from "../../files";
import { IFilesClient } from "../files";

const ATTACHMENTS_DIR = "_attachments";

// Manages the staging and moving of files during the import process, and
// resolves file links in markdown notes to the chronicles path, so they can
// be converted to markdown links.
// The import process is as follows:
// 1. stageFile: Stage all files in the import directory, and store their metadata in the
//   import_files table.
// 2. updateFileLinks: Update all file links in the notes to the chronicles path, so they can be
//  converted to markdown links.
// 3. moveStagedFiles: Move all staged files to the chronicles directory, and update their status
//  in the import_files table.
export class FilesImportResolver {
  private knex: Knex;
  private importerId: string;
  private filesclient: IFilesClient;

  constructor(knex: Knex, importerId: string, filesclient: IFilesClient) {
    this.knex = knex;
    this.importerId = importerId;
    this.filesclient = filesclient;
  }

  // Resolve wikilink to markdown link (w/ chronicles id), and mark the staged
  // file as used (so it will be moved in the next step).
  // [[2024-11-17-20241118102000781.webp]] -> ../_attachments/<chroniclesId>.webp
  private resolveToChroniclesByName = async (
    name: string,
  ): Promise<string | undefined> => {
    // check db for chronicles id matching name, if any
    const result = await this.knex("import_files")
      .where({ filename: name })
      .select("chroniclesId", "extension")
      .first()!;

    if (!result) return;

    const { chroniclesId, extension } = result;
    const updatedPath = this.makeDestinationFilePath(chroniclesId, extension);

    if (updatedPath) {
      await this.knex("import_files").where({ chroniclesId }).update({
        status: "referenced",
      });

      return updatedPath;
    }
  };

  // Resolve a file path (from a markdown link) from its original path to the
  // chronicles path, and mark the staged file as used (so it will be moved in
  // the next step).
  // /path/to/file.jpg -> ../_attachments/<chroniclesId>.jpg
  private resolveToChroniclesByPath = async (
    path: string,
  ): Promise<string | undefined> => {
    const result = await this.knex("import_files")
      .where({ sourcePathResolved: path })
      .select("chroniclesId", "extension")
      .first()!;

    if (!result) return;

    const { chroniclesId, extension } = result;
    const updatedPath = this.makeDestinationFilePath(chroniclesId, extension);

    if (updatedPath) {
      await this.knex("import_files").where({ chroniclesId }).update({
        status: "referenced",
      });

      return updatedPath;
    }
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
  private resolveMarkdownFileLinkToAbsPath = (
    noteSourcePath: string,
    url: string,
  ): string => {
    const urlWithoutQuery = url.split(/\?/)[0] || "";
    return decodeURIComponent(
      path.normalize(
        path.resolve(path.dirname(noteSourcePath), urlWithoutQuery),
      ),
    );
  };

  private resolveMarkdownFileLinkToChroniclesPath = async (
    noteSourcePath: string,
    url: string,
  ): Promise<string | undefined> => {
    const absPath = this.resolveMarkdownFileLinkToAbsPath(noteSourcePath, url);
    return await this.resolveToChroniclesByPath(absPath);
  };

  // Add a file to the import_files table, so it can be moved in the next step;
  // generate a chronicles id so the future chronicles path can be resolved prior
  // to moving the file.
  stageFile = async (filestats: PathStatsFile) => {
    const ext = path.extname(filestats.path);

    try {
      await this.knex("import_files").insert({
        importerId: this.importerId,
        sourcePathResolved: filestats.path, // todo: re-name to pathAbs or pathRelative
        filename: path.basename(filestats.path, ext),
        chroniclesId: uuidv7obj().toHex(),
        extension: ext,
      });
    } catch (err: any) {
      // file referenced more than once in note, or in more than one notes; if import logic
      // is good really dont even need to log this, should just skip
      if ("code" in err && err.code === "SQLITE_CONSTRAINT_PRIMARYKEY") {
        console.log("skipping file already staged", filestats.path);
      } else {
        throw err;
      }
    }
  };

  // todo: Move this back out to importer, just copy pasted to get things working
  // check if a markdown link is a link to a (markdown) note
  private isNoteLink = (url: string) => {
    // we are only interested in markdown links
    if (!url.endsWith(".md")) return false;

    // ensure its not a url with an .md domain
    if (url.includes("://")) return false;

    return true;
  };

  // Determine if an mdast node is a file link
  isFileLink = (
    mdast: mdast.Content | mdast.Root,
  ): mdast is mdast.Image | mdast.Link | mdast.OfmWikiEmbedding => {
    return (
      (((mdast.type === "image" || mdast.type === "link") &&
        !this.isNoteLink(mdast.url)) ||
        mdast.type === "ofmWikiembedding") &&
      !/^(https?|mailto|#|\/|\.|tel|sms|geo|data):/.test(mdast.url)
    );
  };

  //../_attachments/chroniclesId.ext
  private makeDestinationFilePath = (
    chroniclesId: string,
    extension: string,
  ) => {
    return path.join("..", ATTACHMENTS_DIR, `${chroniclesId}${extension}`);
  };

  // use the previously generated list of staged files to update file links in the note,
  // specifically to resolve ![[WikiLinks]] to the chronicles path, so they can be
  // convereted to markdown links.
  // NOTE: MUST have called stageFile on ALL files before calling this!!!
  updateFileLinks = async (
    noteSourcePath: string,
    mdast: mdast.Content | mdast.Root,
  ) => {
    if (this.isFileLink(mdast)) {
      // note: The mdast type will be updated in convertWikiLinks
      // todo: handle ofmWikiLink
      if (mdast.type === "ofmWikiembedding") {
        const updatedUrl = await this.resolveToChroniclesByName(mdast.value);
        if (updatedUrl) {
          mdast.url = updatedUrl;
        }
      } else {
        const updatedUrl = await this.resolveMarkdownFileLinkToChroniclesPath(
          noteSourcePath,
          mdast.url,
        );
        if (updatedUrl) {
          mdast.url = updatedUrl;
        }
      }
    } else {
      if ("children" in mdast) {
        for (const child of mdast.children as any) {
          await this.updateFileLinks(noteSourcePath, child);
        }
      }
    }
  };

  // rudiemntary check to see if a file exists and is readable
  private safeAccess = async (
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

  // After all files staged and links updated, move all staged files to the
  moveStagedFiles = async (
    chroniclesRoot: string,
    importerId: string,
    importDir: string,
  ) => {
    // bug: at this point their status is all pending; someone is not awaiting
    const files = await this.knex("import_files").where({
      importerId,
      status: "referenced",
    });

    const attachmentsDir = path.join(chroniclesRoot, ATTACHMENTS_DIR);
    await fs.promises.mkdir(attachmentsDir, { recursive: true });

    for await (const file of files) {
      const { sourcePathResolved, extension, chroniclesId } = file;

      // todo: convert to just err checking
      let [_, err] = await this.safeAccess(sourcePathResolved, importDir);

      if (err != null) {
        console.error("this.fileExists test fails for ", sourcePathResolved);
        await this.knex("import_files")
          .where({ importerId, sourcePathResolved })
          .update({ error: err });
        continue;
      }

      const destinationFile = path.join(
        chroniclesRoot,
        ATTACHMENTS_DIR,
        `${chroniclesId}${extension}`,
      );

      try {
        await this.filesclient.copyFile(sourcePathResolved, destinationFile);
        console.log("moving to completed", chroniclesId);
        await this.knex("import_files")
          .where({ chroniclesId })
          .update({ status: "complete", error: null });
      } catch (err) {
        console.error("error moving file", chroniclesId, err);
        await this.knex("import_files")
          .where({ chroniclesId })
          .update({ error: (err as Error).message });
        continue;
      }
    }

    // Mark all remaining files as orphaned; can be used to debug import issues,
    // and potentially also be configurable (i.e. whether to import orphaned files
    // or not)
    await this.knex("import_files")
      .where({ status: "pending", importerId })
      .update({ status: "orphaned" });
  };
}
