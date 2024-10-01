import { Database } from "better-sqlite3";
import { diff } from "deep-object-diff";
import { Knex } from "knex";
import path from "path";
import yaml from "yaml";
import { Files } from "../files";
import { IDocumentsClient } from "./documents";
import { IFilesClient } from "./files";
import { IJournalsClient } from "./journals";
import { IPreferencesClient } from "./preferences";
import { ISyncClient } from "./sync";

export type IImporterClient = ImporterClient;

import { testCases } from "./importer.test";

// Temporary helper to test frontmatter parsing and dump the results
// to the console; can convert to real tests at the end.
export function runFrontmatterTests() {
  for (const testCase of testCases) {
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
 * Notion filenames are formatted as `title UUID`
 * example: architecture f35b7cabdf98421d94a27722f0fbdeb8
 * @param filename - The filename (not path, no extension) to strip the UUID from
 *
 * @returns
 */
function stripNotionIdFromTitle(filename: string) {
  const lastSpaceIndex = filename.lastIndexOf(" ");

  // Only strip if a space and UUID are present after the space
  if (
    lastSpaceIndex > 0 &&
    hexIdRegex.test(filename.slice(lastSpaceIndex + 1))
  ) {
    return filename.substring(0, lastSpaceIndex).trim();
  }

  return filename.trim();
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

  private selectImages = (mdast: any, images: any = new Set()) => {
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

  /**
   * Sync the notes directory with the database
   */
  import = async (importDir: string) => {
    const rootDir = await this.preferences.get("NOTES_DIR");

    if (!rootDir || typeof rootDir !== "string") {
      throw new Error("No chronicles root directory set");
    }

    await this.files.ensureDir(importDir);

    // Ensure `importDir` can be accessed, and is not a subdirectory of `rootDir`
    if (importDir.startsWith(rootDir)) {
      throw new Error(
        "Import directory must not reside within the chronicles root directory",
      );
    }

    console.log("importing directory", importDir);
    const rootFolderName = path.basename(importDir);

    // Track created journals and number of documents to help troubleshoot
    // sync issues
    const journals: Record<string, number> = {};
    const erroredDocumentPaths: string[] = [];

    for await (const file of Files.walk(importDir, () => true, {
      // depth: dont go into subdirectories
      depthLimit: 1,
    })) {
      // For some reason it yields the root folder first, what is the point of that shrug
      if (file.path == rootFolderName) continue;
      const { ext, name, dir } = path.parse(file.path);

      // Skip hidden files and directories
      if (name.startsWith(".")) continue;
      if (SKIPPABLE_FILES.has(name)) continue;

      if (file.stats.isDirectory()) {
        const directory = name;
        if (directory === "_attachments") {
          continue;
        }

        // Defer creating journals until we find a markdown file
        // in the directory
        continue;
      }

      // Only process markdown files
      if (ext !== ".md") continue;

      // filename is id; ensure it is formatted as a uuidv7
      // compared to sync, we do not assume the filename is a uuidv7
      // const documentId = path.basename(file.path).replace(".md", "");

      // if (!uuidv7Regex.test(documentId)) {
      //   console.error("Invalid document id", documentId);
      //   continue;
      // }

      // treated as journal name
      // NOTE: This directory check only works because we limit depth to 1
      const dirname = path.basename(dir);
      const journalName = stripNotionIdFromTitle(dirname);

      // Once we find at least one markdown file, we treat this directory
      // as a journal
      if (!(journalName in journals)) {
        await this.files.ensureDir(dirname);

        // current work: Separate create from index; instead just re-work notion folder structure into
        // chronicles structure as we import, then call sync;
        // So, I don't think we need to even create journals, I think the folder is created when the first file is
        // created .... remove this later.
        // await this.journals.index(dirname);
        journals[journalName] = 0;
      }

      // this is only special for sync, not import
      // _attachments is for images (etc), not notes
      // TODO: Allow dir named _attachments; but would need to re-name it on import
      // if (directory == "_attachments") {
      //   continue;
      // }

      // todo: handle repeat import, specifically if the imported folder / file already exists;
      // b/c that may happen when importing multiple sources...

      // todo: sha comparison
      const contents = await Files.read(file.path);
      try {
        const { frontMatter, body, title } = parseTitleAndFrontMatter(contents);
        console.log("parsed", JSON.stringify(frontMatter, null, 2));

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

        try {
          // sync calls createIndex, but we call createDocument
          // NOTE: This is not idempotent; we could make it so by tracking
          // the original file path
          await this.documents.createDocument(
            {
              journal: journalName, // using name as id
              content: body,
              title: title, //stripNotionIdFromTitle(name),
              tags: frontMatter.tags || [],
              createdAt: frontMatter.createdAt,
              updatedAt: frontMatter.updatedAt,
            },
            false, // don't index; we'll call sync after import
          );
        } catch (e) {
          erroredDocumentPaths.push(file.path);

          // https://github.com/cloverich/chronicles/issues/248
          console.error(
            "Error creating document",
            file.path,
            "for journal",
            dirname,
            e,
          );
        }
      } catch (e) {
        console.error("Error parsing front matter", file.path, e);
        // console.log(contents);
        continue;
      }
    }

    console.log("import complete; calling sync to update indexes");
    await this.syncs.sync();
  };
}
