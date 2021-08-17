import { PrismaClient } from "@prisma/client";
import { Files } from "./api/files";
import { parser, stringifier } from "./markdown";
import { Root, Content } from "mdast";
import { shouldIndexDay } from "./api/indexer";
import fs from "fs";
import path from "path";
import { DateTime } from "luxon";

const client = new PrismaClient();
const notesDir = process.argv[2];
console.log("using notes directory: ", notesDir);

// Hmmm... maybe this is built in to Prisma client somehow
async function findOrCreate(name: string) {
  try {
    return await client.journal2.create({
      data: {
        name: name,
      },
    });
  } catch (err) {
    if (err.code === "P2002") {
      // already exists
      return await client.journal2.findFirst({ where: { name } });
    } else {
      throw err;
    }
  }
}

// Copy pasta from shouldIndex and exported for my importChronicles script...
function dateFromPrevalidatedFilepath(filepath: string) {
  const { ext, name } = path.parse(filepath);
  if (ext !== ".md") return false;
  if (name.startsWith(".")) return false;

  // NOTE: This manages to respect the timezone, so if I pull 2020-05-01,
  // turn it into a date, then stringify it, it gives me a 5 hour (CDT) offset.
  // Filename (without extension) must be a valid date
  const parsedDate = DateTime.fromISO(name);
  if (name !== parsedDate.toISODate()) return false;

  return parsedDate;
}

// Import documents from my old file based system, which used markdown files
// in a one note per day system: /my-journal/2020/05/01/2020-05-01.md
async function importChronicles() {
  // list all journals in my notes directory
  const journals = fs
    .readdirSync(notesDir)
    // excludes '.DS_Store' and other misc. directories
    .filter((folder) => !folder.startsWith("."));

  // walk journals one by one
  for (const journal of journals) {
    const jourrnalModel = await findOrCreate(journal);

    for await (const file of Files.walk(
      path.join(notesDir, journal),
      shouldIndexDay
    )) {
      const parsed = await loadDocument(file.path);
      // console.log("parsed", parsed);
      if (parsed.mdast.type !== "root") throw new Error("oh my");

      // for await (const document of sections(parsed.mdast as Root)) {
      for await (const document of splitOnTitle(parsed.contents)) {
        const date = dateFromPrevalidatedFilepath(file.path);
        if (!date) throw new Error(`expected valid date for ${file.path}`);

        // document.createdAt = document.updatedAt = date.toMillis();
        const doc = await client.document2.create({
          data: {
            journalId: jourrnalModel!.id,
            createdAt: date.toJSDate(),
            updatedAt: date.toJSDate(),
            content: document.content,
            title: document.title,
          },
        });
        console.log("created", doc.id);
        // console.log(
        //   journal,
        //   jourrnalModel?.id,
        //   date.toMillis(),
        //   "title:",
        //   document.title,
        //   document.content.length,
        //   "bytes"
        // );
      }
    }
  }

  // for each section
  // image links? leave in place for now...
  // create entry (journalId, title if any)
}

async function testOne() {
  const parsed = await loadDocument(
    "/Users/cloverich/Google Drive/notes/chronicles/2020/06/2020-06-30.md"
  );
  console.log("parsed", parsed);
  if (parsed.mdast.type !== "root") throw new Error("oh my");

  for await (const document of sections(parsed.mdast as Root)) {
    // console.log(document);
  }
}

async function loadDocument(filepath: string) {
  // date?
  const contents = await Files.read(filepath);
  return {
    contents: contents,
    mdast: parser.parse(contents),
  };
}

function createDocument(nodes: Content[]) {
  // console.log(
  //   "\ncreateDocument\n",
  //   nodes,
  //   stringifier.stringify({ type: "root", children: nodes })
  // );
  const firstNode = nodes[0];
  if (firstNode.type === "heading" && firstNode.depth === 1) {
    return {
      title: stringifier.stringify(firstNode).slice(2),
      content: stringifier.stringify({
        type: "root",
        children: nodes.slice(1),
      }),
    };
  } else {
    return {
      title: "",
      content: stringifier.stringify({ type: "root", children: nodes }),
    };
  }
}

function* sections(root: Root) {
  // console.log("sections", root);
  if (root.children.length === 0) {
    console.warn("document had no children");
    return;
  }

  // for (const child of root.children) {
  //   console.log("\n\n");
  //   console.log(current);
  //   console.log(stringifier.stringify(child));
  // }

  let currentNodes: Content[] = [root.children[0]];
  let idx = 1;

  for (const node of root.children) {
    if (node.type === "heading" && node.depth === 1) {
      // start a new document...
      yield createDocument(currentNodes);
      currentNodes = [node];
    } else {
      currentNodes.push(node);
    }
  }

  // if remaining items on buffer, yield a document
  if (currentNodes.length) yield createDocument(currentNodes);
}

// Split a document into multiple documents by presence of a top-level
// markdown heading, i.e. "# This is a heading"
function splitOnTitle(
  content: string
): Array<{ title: string; content: string }> {
  const lines = content.split("\n");

  // Clear a few edge cases to simplify the rest of the implementation:
  // Empty -- return empty array
  // One document with only a title -- return empty array
  // One document with only one line -- return one document
  if (lines.length === 0) return [];

  if (lines.length === 1) {
    // Drop documents that have only a title and no content
    if (lines[0].startsWith("# ")) return [];
    return [{ title: "", content: lines[0] }];
  }

  function makeDocument(lines: string[]) {
    const hasTitle = lines[0].startsWith("# ");
    return {
      title: hasTitle ? lines[0].slice(2) : "",
      content: hasTitle ? lines.slice(1).join("\n") : lines.join("\n"),
    };
  }

  let nextDocumentLines: string[] = [];
  const documents: Array<{ title: string; content: string }> = [];

  for (const line of lines) {
    if (line.startsWith("# ") && nextDocumentLines.length > 0) {
      // append existing lines as document, then create a new one
      documents.push(makeDocument(nextDocumentLines));
      nextDocumentLines = [line];
    } else {
      nextDocumentLines.push(line);
    }
  }

  // clear the remaining buffered lines
  if (nextDocumentLines.length) {
    documents.push(makeDocument(nextDocumentLines));
  }

  return documents;
}

importChronicles().then(() => {
  process.exit(0);
}, console.error);
