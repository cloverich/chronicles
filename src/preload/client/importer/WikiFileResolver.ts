import fs from "fs";
import { Knex } from "knex";
import mdast from "mdast";
import path from "path";
import { uuidv7obj } from "uuidv7";
import { Files, PathStatsFile } from "../../files";
import { IFilesClient } from "../files";
import { SKIPPABLE_FILES } from "../importer";

const ATTACHMENTS_DIR = "_attachments";

// For resolving ![[Wiki Embedding]] links, I need a complete list of all non-.md
// files in the import directory, these ridiuclous things are not absolute or
// relative and could be anywhere in the import directory.
export class WikiFileResolver {
  private knex: Knex;
  private importerId: string;
  private filesclient: IFilesClient;

  private constructor(
    knex: Knex,
    importerId: string,
    filesclient: IFilesClient,
  ) {
    this.knex = knex;
    this.importerId = importerId;
    this.filesclient = filesclient;
  }

  static async init(
    importDir: string,
    knex: Knex,
    importerId: string,
    filesclient: IFilesClient,
  ) {
    // todo: This routine was refactored and instead of walking interanlly, should
    // extertnally pass files to the resolver to allow walkijng import directoroy only once,
    // then do the filename resolving post-move.
    const resolver = new WikiFileResolver(knex, importerId, filesclient);

    for await (const file of Files.walk(importDir, (filestats) => {
      if (!filestats.stats.isFile()) return false;

      const name = path.basename(filestats.path);
      if (name.startsWith(".")) return false;
      if (SKIPPABLE_FILES.has(name)) return false;
      return !filestats.path.endsWith(".md");
    })) {
      await resolver.stageFile(file);
    }

    return resolver;
  }

  // Resolve a wiki embedding link to a chronicles path, for updating the link
  // i.e. [[2024-11-17-20241118102000781.webp]] -> ../_attachments/<chroniclesId>.webp
  resolveToChroniclesByName = async (
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
      return updatedPath;
    } else {
      console.warn("Failed to resolve file link", name);
      return;
    }
  };

  resolveToChroniclesByPath = async (
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
      return updatedPath;
    } else {
      console.warn("Failed to resolve file link", path);
      return;
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

  resolveMarkdownFileLinkToChroniclesPath = async (
    noteSourcePath: string,
    url: string,
  ): Promise<string | undefined> => {
    const absPath = this.resolveMarkdownFileLinkToAbsPath(noteSourcePath, url);
    return this.resolveToChroniclesByPath(absPath);
  };

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

  //todo: Move this back out to importer, just copy pasted to get things working
  // check if a markdown link is a link to a (markdown) note
  private isNoteLink = (url: string) => {
    // we are only interested in markdown links
    if (!url.endsWith(".md")) return false;

    // ensure its not a url with an .md domain
    if (url.includes("://")) return false;

    return true;
  };

  // Mdast helper to determine if a node is a file link
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

  // Because I keep forgetting extension already has a . in it, etc.
  // Returns relative or absolute path based which one attachmentsPath
  // Chronicles file references are always ../_attachments/chroniclesId.ext as
  // of this writing.
  private makeDestinationFilePath = (
    chroniclesId: string,
    extension: string,
  ) => {
    return path.join("..", ATTACHMENTS_DIR, `${chroniclesId}${extension}`);
  };

  // use the mapping of moved files to update the file links in the note
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
          console.log(
            "updated url (old)",
            mdast.value,
            "(new)",
            mdast.url,
            mdast,
          );
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

  moveStagedFiles = async (
    chroniclesRoot: string,
    importerId: string,
    importDir: string,
  ) => {
    const files = await this.knex("import_files").where({
      importerId,
      status: "pending",
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
        await this.knex("import_files")
          .where({ importerId, sourcePathResolved })
          .update({ status: "complete", error: null });
      } catch (err) {
        await this.knex("import_files")
          .where({ importerId, sourcePathResolved })
          .update({ error: (err as Error).message });
        continue;
      }
    }
  };
}
