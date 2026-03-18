import { and, eq } from "drizzle-orm";
import { type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import fs from "fs";
import mdast from "mdast";
import path from "path";
import { isNoteLink } from "../markdown/index";
import { createId } from "../preload/client/util";
import { PathStatsFile, mkdirp } from "../preload/utils/fs-utils";
import * as schema from "./schema";

const ATTACHMENTS_DIR = "_attachments";

// Minimal interface — only the method FilesImportResolver needs
export interface IFilesClientForImport {
  copyFile(src: string, dest: string): Promise<string>;
}

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
  private db: BunSQLiteDatabase<typeof schema>;
  private importerId: string;
  private filesclient: IFilesClientForImport;

  constructor(
    db: BunSQLiteDatabase<typeof schema>,
    importerId: string,
    filesclient: IFilesClientForImport,
  ) {
    this.db = db;
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
    const [result] = await this.db
      .select({
        chroniclesId: schema.importFiles.chroniclesId,
        extension: schema.importFiles.extension,
      })
      .from(schema.importFiles)
      .where(
        and(
          eq(schema.importFiles.filename, name),
          eq(schema.importFiles.importerId, this.importerId),
        ),
      )
      .limit(1);

    if (!result) return;

    const { chroniclesId, extension } = result;
    const updatedPath = this.makeDestinationFilePath(chroniclesId, extension);

    if (updatedPath) {
      await this.db
        .update(schema.importFiles)
        .set({ status: "referenced" })
        .where(eq(schema.importFiles.chroniclesId, chroniclesId));

      return updatedPath;
    }
  };

  // Resolve a file path (from a markdown link) from its original path to the
  // chronicles path, and mark the staged file as used (so it will be moved in
  // the next step).
  // /path/to/file.jpg -> ../_attachments/<chroniclesId>.jpg
  private resolveToChroniclesByPath = async (
    filePath: string,
  ): Promise<string | undefined> => {
    const [result] = await this.db
      .select({
        chroniclesId: schema.importFiles.chroniclesId,
        extension: schema.importFiles.extension,
      })
      .from(schema.importFiles)
      .where(eq(schema.importFiles.sourcePathResolved, filePath))
      .limit(1);

    if (!result) return;

    const { chroniclesId, extension } = result;
    const updatedPath = this.makeDestinationFilePath(chroniclesId, extension);

    if (updatedPath) {
      await this.db
        .update(schema.importFiles)
        .set({ status: "referenced" })
        .where(eq(schema.importFiles.chroniclesId, chroniclesId));

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
      await this.db.insert(schema.importFiles).values({
        importerId: this.importerId,
        // note: assumes here and later this is an absolute path; assumption
        // based on Files.walk behavior
        sourcePathResolved: filestats.path,
        filename: path.basename(filestats.path, ext),
        chroniclesId: createId(filestats.stats.birthtimeMs),
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

  // Determine if an mdast node is a file link
  isFileLink = (
    mdast: mdast.Content | mdast.Root,
  ): mdast is mdast.Image | mdast.Link | mdast.OfmWikiEmbedding => {
    return (
      (((mdast.type === "image" || mdast.type === "link") &&
        !isNoteLink(mdast)) ||
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
    const files = await this.db
      .select()
      .from(schema.importFiles)
      .where(
        and(
          eq(schema.importFiles.importerId, importerId),
          eq(schema.importFiles.status, "referenced"),
        ),
      );

    const attachmentsDir = path.join(chroniclesRoot, ATTACHMENTS_DIR);
    await mkdirp(attachmentsDir);

    for (const file of files) {
      const { sourcePathResolved, extension, chroniclesId } = file;

      // todo: convert to just err checking
      let [_, err] = await this.safeAccess(sourcePathResolved, importDir);

      if (err != null) {
        console.error(
          "this.fileExists test fails for ",
          sourcePathResolved,
          err,
        );
        await this.db
          .update(schema.importFiles)
          .set({ error: err })
          .where(
            and(
              eq(schema.importFiles.importerId, importerId),
              eq(schema.importFiles.sourcePathResolved, sourcePathResolved),
            ),
          );
        continue;
      }

      const destinationFile = path.join(
        chroniclesRoot,
        ATTACHMENTS_DIR,
        `${chroniclesId}${extension}`,
      );

      try {
        await this.filesclient.copyFile(sourcePathResolved, destinationFile);
        await this.db
          .update(schema.importFiles)
          .set({ status: "complete", error: null })
          .where(eq(schema.importFiles.chroniclesId, chroniclesId));
      } catch (err) {
        console.error("error moving file", chroniclesId, err);
        await this.db
          .update(schema.importFiles)
          .set({ error: (err as Error).message })
          .where(eq(schema.importFiles.chroniclesId, chroniclesId));
        continue;
      }
    }

    // Mark all remaining files as orphaned; can be used to debug import issues,
    // and potentially also be configurable (i.e. whether to import orphaned files
    // or not)
    await this.db
      .update(schema.importFiles)
      .set({ status: "orphaned" })
      .where(
        and(
          eq(schema.importFiles.status, "pending"),
          eq(schema.importFiles.importerId, importerId),
        ),
      );
  };
}
