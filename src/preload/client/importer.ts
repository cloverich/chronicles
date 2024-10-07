import { Database } from "better-sqlite3";
import { diff } from "deep-object-diff";
import { Knex } from "knex";
import path from "path";
import yaml from "yaml";
import { Files, PathStatsFile } from "../files";
import { IDocumentsClient } from "./documents";
import { IFilesClient } from "./files";
import { IJournalsClient, validateJournalName } from "./journals";
import { IPreferencesClient } from "./preferences";
import { ISyncClient } from "./sync";

// todo: this is a dumb way to do this.. see how ts-mdast is exported
import * as mdast from "../../markdown/remark-slate-transformer/models/mdast";

export type IImporterClient = ImporterClient;

import { uuidv7 } from "uuidv7";
import { mdastToString, stringToMdast } from "../../markdown";
import { titleFrontMatterTestCases } from "./importer.test";

// Temporary helper to test frontmatter parsing and dump the results
// to the console; can convert to real tests at the end.
export function runFrontmatterTests() {
  for (const testCase of titleFrontMatterTestCases) {
    console.log("TEST:", testCase.expected.title);
    const result = parseTitleAndFrontMatter(testCase.input);
    if (!result.frontMatter) {
      console.info("FAILED: no front matter");
      console.info(testCase.input);
      break;
    } else {
      if (result.title !== testCase.expected.title) {
        console.error("FAILED: title");
        console.error("expected:", testCase.expected.title);
        console.error("result:", result.title);
        console.error();
        break;
      }

      if (result.body !== testCase.expected.body) {
        console.error("FAILED: body");
        console.error("expected:", testCase.expected.body);
        console.error("result:", result.body);
        console.error();
        break;
      }

      // expect(result.frontMatter).to.deep.equal(testCase.expected.frontMatter);

      if (
        JSON.stringify(result.frontMatter) !==
        JSON.stringify(testCase.expected.frontMatter)
      ) {
        console.error("FAILED: front matter");
        console.error(diff(result.frontMatter, testCase.expected.frontMatter));
        console.error("expected:", testCase.expected.frontMatter);
        console.error("result:", result.frontMatter);
        // console.error(
        //   "expected:",
        //   JSON.stringify(testCase.expected.frontMatter),
        // );
        // console.error("result:", JSON.stringify(result.frontMatter));
        // console.error();
        break;
      }

      console.info("SUCCESS:", result);
      console.info();
      console.info();
    }
  }
}

interface ParseTitleAndFrontMatterRes {
  title: string;
  frontMatter: Record<string, any>;
  body: string;
}

function parseTitleAndFrontMatter(contents: string) {
  const lines = contents.split("\n");

  let title = "";
  let frontMatter: Record<string, any> = {};
  let bodyStartIndex = 0;

  // Process the title (assuming it's the first line starting with '#')
  if (lines[0].startsWith("#")) {
    title = lines[0].replace(/^#\s*/, "").trim();
    bodyStartIndex = 1; // Move index to the next line
  }

  // Check for front matter by looking line by line until an empty line
  let frontMatterLines = [];

  // Notion style front matter has no --- border, just new lines; but support
  // --- style too b/c that is what I used in other notes.... this is maybe stupid
  // supporting bothin the same importer. Likely refactor when this is properly abstracted
  // :hopesanddreams:
  let fontMatterBorderTriggered = false;

  // Notion style document is:
  // title, newline, frontmatter(optional), newline(if front matter), body
  let firstSpaceEncountered = false;
  for (let i = bodyStartIndex; i < lines.length; i++) {
    const line = lines[i].trim();

    // Track the start of frontmatter if using ---, so we can later
    // detect --- and infer the end of front matter (as opposed to an empty line)
    if (i == bodyStartIndex && line == "---") {
      fontMatterBorderTriggered = true;
      continue;
    }

    // Stop if we reach an empty line (indicating end of front matter)
    if (
      i > bodyStartIndex &&
      fontMatterBorderTriggered &&
      line.startsWith("---")
    ) {
      bodyStartIndex = i + 1; // Move index to start of body content
      break;
    }

    // Stop if we reach an empty line (indicating end of front matter)
    if (line === "" && !fontMatterBorderTriggered) {
      if (firstSpaceEncountered) {
        bodyStartIndex = i + 1; // Move index to start of body content
        break;
      } else {
        firstSpaceEncountered = true;
        continue;
      }
    }

    // Add potential front matter lines for processing
    frontMatterLines.push(line);
  }

  if (frontMatterLines.length) {
    const rawFrontMatter = frontMatterLines.join("\n");
    const processedFrontMatter = preprocessFrontMatter(rawFrontMatter);

    try {
      frontMatter = yaml.parse(processedFrontMatter);

      if (frontMatter.Tags) {
        frontMatter.tags = frontMatter.Tags;
        delete frontMatter.Tags;
      }

      // Process tags if present
      if (frontMatter.tags) {
        frontMatter.tags = frontMatter.tags
          .split(",")
          .map((tag: string) => tag.trim())
          .filter(Boolean);
      }

      // Idiosyncratic handling of my particular front matter keys
      // 1. I have createdAt key, but format is August 12, 2020 8:13 PM
      // 2. updatedAt is key "Last Edited"
      frontMatter.updatedAt = frontMatter["Last Edited"];
      if (frontMatter.updatedAt) {
        const date = new Date(frontMatter.updatedAt);
        frontMatter.updatedAt = date.toISOString();
        delete frontMatter["Last Edited"];
      }

      if (frontMatter.createdAt) {
        const date = new Date(frontMatter.createdAt);
        frontMatter.createdAt = date.toISOString();
      }
    } catch (e) {
      console.error("Error parsing front matter", e);
      console.log("Front matter:", rawFrontMatter);
      throw e;
    }
  }

  // The remaining lines form the body
  const body = lines.slice(bodyStartIndex).join("\n").trim();

  return { title, frontMatter, body };
}

// Reused preprocessFrontMatter for cleaning up front matter before parsing
function preprocessFrontMatter(content: string) {
  return (
    content
      // Handle keys with no values by assigning empty strings
      .replace(/^(\w+):\s*$/gm, '$1: ""')

      // Check if value contains special characters and quote them if necessary
      .replace(/^(\w+):\s*(.+)$/gm, (match, key, value) => {
        // If the value contains special characters or a newline, quote the value
        if (value.match(/[:{}[\],&*#?|\-<>=!%@`]/) || value.includes("\n")) {
          // If the value isn't already quoted, add double quotes
          if (!/^['"].*['"]$/.test(value)) {
            // Escape any existing double quotes in the value
            value = value.replace(/"/g, '\\"');
            return `${key}: "${value}"`;
          }
        }
        return match; // Return unchanged if no special characters
      })
  );
}

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

  updateImportItemLink = async (item: ImportItemLink) => {
    // todo: try catch:
    // error { code: SQLITE_CONSTRAINT_PRIMARYKEY } } --> already exists (acceptable!)
    this.db
      .prepare(
        `UPDATE import_links SET sourceChroniclesId = :sourceChroniclesId, sourceChroniclesPath = :sourceChroniclesPath
        WHERE sourcePath = :sourcePath AND sourceId = :sourceId`,
      )
      .run(item);
  };

  stageImportItems = async (
    importDir: string,
    rootFolderName: string,
    importerId: string,
  ) => {
    // for processNote; maps the original folder path to the fixed name
    const journalsMapping: Record<string, string> = {};
    for await (const file of Files.walk(importDir, () => true, {
      // depth: dont go into subdirectories
      // depthLimit: 1,
    })) {
      this.processNote(file, importDir, importerId, journalsMapping);
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
        console.error("no mapping for", sourceUrlResolved);
        continue;
      }
      mappedLinks[link.url] = `../${mapped.journal}/${mapped.chroniclesId}.md`;
    }

    this.updateLinks(mdast, mappedLinks);
  };

  /**
   * Sync the notes directory with the database
   */
  import = async (importDir: string) => {
    const importerId = uuidv7();
    const rootDir = await this.preferences.get("NOTES_DIR");

    // Sanity check this is set first, because I'm hacking a lot of stuff together
    // in tiny increments, many things bound to get mixed up
    if (!rootDir || typeof rootDir !== "string") {
      throw new Error("No chronicles root directory set");
    }

    // Ensure `importDir` is a directory and can be accessed
    await this.files.ensureDir(importDir);

    // Confirm its not a sub-directory of the notes root `rootDir`
    if (importDir.startsWith(rootDir)) {
      throw new Error(
        "Import directory must not reside within the chronicles root directory",
      );
    }

    console.log("importing directory", importDir);
    const rootFolderName = path.basename(importDir);

    await this.stageImportItems(importDir, rootFolderName, importerId);

    // At this point, import_items and import_links are populated;
    // we can iterate and update them, before syncing
    // This whole thing is a little silly because I am pulling all the contents
    // out of the database, i could jsut do this whole ting in memory if I was going to do that
    // todo: Calculate the disk size of my total note repository and see just how stupid
    // this effort is.
    const items: ImportItemDb[] = await this.db
      .prepare("select * from import_items")
      .all();

    // Links point to the original documents path (sourcePath). Build a mapping
    // of each document's sourcePath to its eventual Chronicles path (journal/chroniclesId.md)
    // With this, we can update links in each document.
    // TODO: I think we can generate the link mapping in the database,
    // like destChroniclesId = joinedImportItemChroniclesId (join on sourceUrlResolved)
    const linkMapping: Record<
      string,
      { journal: string; chroniclesId: string }
    > = {};
    for (const item of items) {
      if ("error" in item && item.error) continue;
      const { journal, chroniclesId, sourcePath } = item;
      linkMapping[sourcePath] = { journal, chroniclesId };
    }

    for (const item of items) {
      if ("error" in item && item.error) {
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
      } catch (err) {
        // todo: pre-validate ids are unique
        // https://github.com/cloverich/chronicles/issues/248
        console.error(
          "Error creating document after import",
          item.sourcePath,
          err,
        );
        // todo: track create_error on the import_item
      }
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
        // todo: track unmapped links
        // technically I can pre-work this out in the database, and have done so for my import
        // (44/44 note links mapped). But an error here would indicate programmatic issue so...
        // hmmm where to record this?
        console.error("link not found", links, url);
        throw new Error("link not found");
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
  ): string => {
    // Notion folder names have unique ids, just like the notes themselves.
    // Also, the folder may be nested, so we need to strip the ids from each
    // ex: "Documents abc123efg"
    // ex: "Documents abc123eft/My Nested Folder hijk456klm"
    const folderNameMaybeNestedWithIds = path
      .resolve(folderPath)
      .split(importDir)[1];

    // if we've already generated a name for this folder, return it
    if (folderNameMaybeNestedWithIds in journals) {
      return journals[folderNameMaybeNestedWithIds];
    }

    // strip notion ids from each (potential) folder name, then re-assmble
    let journalName = folderNameMaybeNestedWithIds
      // break into parts
      .split(path.sep)
      // if leading with path.sep, kick out ''
      .filter(Boolean)
      // Strip notionId from each part
      // "Documents abc123eft" -> "Documents"
      .map((part) => {
        const [folderNameWithoutId] = stripNotionIdFromTitle(part);
        return folderNameWithoutId;
      })
      // re-join w/ _ to treat it as a single folder going forward
      .join("_");

    // confirm its valid.
    try {
      validateJournalName(journalName);

      // also ensure its unique
      if (Object.values(journals).includes(journalName)) {
        throw new Error(`Journal name ${journalName} not unique`);
      }
    } catch (err) {
      journalName = uuidv7();

      // too long, reserved name, non-unique, etc.
      console.warn(
        "Error validating journal name",
        journalName,
        err,
        "Generating a new name:",
        journalName,
      );
    }

    // cache for next time
    journals[folderNameMaybeNestedWithIds] = journalName;

    return journalName;
  };

  private processNote = async (
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

    const journalName = this.inferOrGenerateJournalName(
      dir,
      importDir,
      journals,
    );
    // todo: handle repeat import, specifically if the imported folder / file already exists;
    // b/c that may happen when importing multiple sources...

    // todo: sha comparison
    const contents = await Files.read(file.path);
    const [, notionId] = stripNotionIdFromTitle(name);

    try {
      // todo: fallback title to filename - uuid
      const { frontMatter, body, title } = parseTitleAndFrontMatter(contents);
      // console.log("parsed", JSON.stringify(frontMatter, null, 2));

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

      // todo: Unlike sync, here we need to handle images and note references
      // there are two kinds of note references: file references, and [[Magic References]]
      const mdast = stringToMdast(body) as any as mdast.Root; // todo: type these better...
      const links = this.selectLinks(mdast);

      // skip if no links for now
      // if (!links.size) return;
      // console.log(links);

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
        content: body,
        frontMatter: JSON.stringify(frontMatter),
        status: "pending",
      };

      this.saveImportItem(importItem);

      const linkItems: ImportItemLink[] = [];
      for (const link of links) {
        const sourceFolderPath = path.dirname(file.path);
        const sourceUrlResolved = path.resolve(sourceFolderPath, link.url);
        const canAccessFile = await this.files.validFile(sourceUrlResolved);

        //

        linkItems.push({
          importerId,
          sourceChroniclesId: importItem.chroniclesId,
          sourceChroniclesPath: importItem.chroniclesPath,
          sourceId: notionId,
          sourceUrl: link.url,

          // sourceUrlResolvedToTheFullTargetPath
          sourceUrlResolved: sourceUrlResolved,
          destChroniclesId: "", // todo: fill this in later
          sourceUrlResolveable: canAccessFile ? 1 : 0,
          kind: "link",
          title: link.title,
          journal: journalName,
        });
      }

      await this.saveImportItemLinks(linkItems);
      // this.saveImportItemLinks(
      //   Array.from(links).map<ImportItemLink>((link) => {
      //     // compute the destination (import_item) for each link

      //   }),
      // );

      // temporarily skip importing, just logging links
      return;
    } catch (e) {
      console.error("Error parsing front matter", file.path, e);
      // console.log(contents);
      return;
    }
  };
}
