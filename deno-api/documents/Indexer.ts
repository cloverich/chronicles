import {
  walk,
  ensureDir,
  readFileStr,
} from "https://deno.land/std@v0.59.0/fs/mod.ts";
import * as path from "https://deno.land/std@v0.59.0/path/mod.ts";
const { readFile, writeFile, stat } = Deno;
import { parser, stringifier } from "../md/index.ts";
import { Root } from "../md/types/mdast.d.ts";
import { createDb } from "./db.ts";
import { DB } from "../deps.ts";
import { FileDAO } from "./FileDAO.ts";

interface DocsWalkResult {
  count: number;
  // path to journal
  path: string;
}

interface Journal {
  name: string;
  path: string;
}

const reg = /\d{4}-\d{2}-\d{2}/;
// reg.test()

interface NodeSchema {
  journal: string; // future: id
  date: string;
  type: string; // node type
  idx: number;
  attributes: string; // jsonb
}

class IndexParsingError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "IndexParsingError";
  }
}

export class Indexer {
  private db: DB;
  constructor(db: DB) {
    this.db = db;
  }

  insert = (journal: string, date: string, node: any) => {
    // NOTE: Lazy work here. I want to serialize most node attributes into a JSOn column that
    // I could eventually search on, like "depth" for heading nodes. But other properties on the node
    // (like children and and position) I do not need. So, pull them off and discard.
    // I could delete node.position but I may need node.children in subsequent processing steps, like
    // when pulling listItem children off of list nodes to independnetly index....
    // Basically the structure of MDAST is affecting how I process it. Blargh.
    const { type, children, position, ...atributes } = node;

    let contents: string;

    try {
      contents = stringifier.stringify(node);
    } catch (err) {
      throw new IndexParsingError(err);
    }

    // todo: use auto-increment to track parent node
    this.db.query(
      "INSERT INTO nodes (journal, date, type, contents, attributes) VALUES (?, ?, ?, ?, ?)",
      [journal, date, type, contents, JSON.stringify(atributes)]
    );
  };

  /**
   * Re-index a document - e.g. after its been updated
   * @param journal - name of journal
   * @param date
   * @param contents
   */
  update = async (journal: string, date: string, contents: string) => {
    const parsed = parser.parse(contents);
    await this.db.query(
      "DELETE FROM nodes where journal = :journal and date = :date",
      { journal, date }
    );
    await this.indexNode(journal, date, parsed);
  };

  /**
   * Recursively index an mdast document
   *
   * NOTE: This is a naive strategy to make content searchable by node type.
   * Little thought has been applied to the right way to index content, and
   * all the things that go with that.
   * @param journal
   * @param date
   * @param node - TODO: Base node type
   */
  indexNode = async (journal: string, date: string, node: Root | any) => {
    if (node.type !== "root") {
      try {
        await this.insert(journal, date, node);
      } catch (err) {
        // Because I am recursively indexing _all_ nodeTypes, the remark parser
        // I am using to stringify node content may not have a "compiler" for a particular
        // node: Ex - if compiles a table node, but will choke if passed its child tableRow
        // node directly. Ignore these errors and simply don't index those child nodes.
        // Longer term, I'll likely use a different indexing strategy / implementation so
        // not concerned about this right now.
        if (err instanceof IndexParsingError) {
          // ignore
        } else {
          console.error(
            "Error indexing node for journal ${journal}: It may not show up correctly"
          );
          console.error(err);
        }
      }
    }

    if (!node.children) return;

    for (const child of node.children) {
      await this.indexNode(journal, date, child);
    }
  };

  index = async (srcDir: string, name: string) => {
    const sr = await this.walk(srcDir, name);

    for (const entry of sr.results) {
      const contents = await FileDAO.read(sr.path, entry);
      // todo: track parsing errors so you understand why your content
      // isn't showing up in your journal view (failed to index).
      try {
        const parsed = parser.parse(contents);
        await this.indexNode(sr.journal, entry, parsed);
      } catch (err) {
        // Log and continue, so we can index remaining journal documents
        console.error(
          `[Indexer.index] error indexing entry ${sr.path} - ${entry}`,
          err
        );
      }
    }
  };

  /**
   *
   * @param srcDir - Journal directory to walk,looking for files to index
   * @param name - The journal name. Treated as a key to the journals table. Stupid.
   */
  private walk = async (srcDir: string, name: string) => {
    const sr = {
      count: 0,
      results: [] as string[],
      journal: name,
      path: srcDir,
    };

    // NOTE: Docs say walk is lexicographical but if I log out statements, its not walking in order
    for await (const entry of walk(srcDir, {
      includeDirs: false,
      exts: ["md", "mdown"],
    })) {
      // todo: process as a stream
      if (reg.test(entry.name)) {
        sr.results.push(path.parse(entry.name).name);
      }
      // I used this previously to generate YYYY-MM-DD filenames
      // Feel like I'll use it again soon...
      // const dateStr = fileInfo.mtime!.toISOString().slice(0, 10);
    }

    return sr;
  };
}
