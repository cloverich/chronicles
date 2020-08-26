import path from "path";
import { parser, stringifier } from "../markdown";
import { Root } from "ts-mdast";
import { Database } from "./database";
import { Files, PathStatsFile } from "./files";
import { IJournal } from "./journals";
import { DateTime } from "luxon";

function isISODate(dateStr: string) {
  const parsedDate = DateTime.fromISO(dateStr);
  return dateStr === parsedDate.toISODate();
}

const reg = /\d{4}-\d{2}-\d{2}/;

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
  private db: Database;
  constructor(db: Database) {
    this.db = db;
  }

  insert = (journal: string, date: string, node: any) => {
    // NOTE: Lazy work here. I want to serialize most node attributes into a JSON column that
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
    this.db
      .prepare(
        "INSERT INTO nodes (journal, date, type, contents, attributes) VALUES (:journal, :date, :type, :contents, :attributes)"
      )
      .run({
        journal,
        date,
        type,
        contents,
        attributes: JSON.stringify(atributes),
      });
  };

  /**
   * De-index a journals documents
   *
   * @param journal - name of journal to remove from indexed nodes table
   */
  deindex = async (journal: string) => {
    const stmt = this.db.prepare("DELETE FROM nodes where journal = :journal");
    stmt.run({ journal });
  };

  /**
   * Re-index a document - e.g. after its been updated
   * @param journal - name of journal
   * @param date
   * @param contents
   */
  update = async (journal: string, date: string, contents: string) => {
    const parsed = parser.parse(contents);
    const stmt = this.db.prepare(
      "DELETE FROM nodes where journal = :journal and date = :date"
    );
    stmt.run({ journal, date });
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
    // Redundant when called by index since Files.walk shouldIndex does this. But
    // I put this here because of a bug so.... hmmm..
    if (!isISODate(date))
      throw new Error(
        `[Indexer.indexNode] Expected an ISO formatted date but got ${date}`
      );

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

  index = async (journal: IJournal) => {
    const shouldFunc = getShouldFunc(journal.unit);

    for await (const entry of Files.walk(journal.url, shouldFunc)) {
      console.debug("[Indexer.index] processing entry", entry.path);

      const contents = await Files.read(entry.path);
      // todo: track parsing errors so you understand why your content
      // isn't showing up in your journal view (failed to index).
      try {
        const parsed = parser.parse(contents);

        // BUG ALERT: I was passing `entry.path` as second argument, when it wanted the
        // filename, because it wants an ISODate: 2020-05-01, which is how we name files.
        // I added `isISODate` to indexNode.
        const filename = path.parse(entry.path).name;

        await this.indexNode(journal.name, filename, parsed);
      } catch (err) {
        // Log and continue, so we can index remaining journal documents
        console.error(
          `[Indexer.index] error indexing entry ${entry.path}`,
          err
        );
      }
    }
  };
}

// BELOW: HELPERS FOR DETERMINING IF A FILE SHOULD BE INDEXED, BASED ON FILENAME
// AND THE JOURNAL'S "unit" -- day, month, year.
// SEE Files.walk usage

// To check for filename structure and directory naming convention
// Has match groups for year, month, and filename parts
// ex match: /journals/reviews/2020/04/2020-04-01.md
const fileformat = /\/(\d{4})\/(\d{2})\/(\d{4})-(\d{2})-\d{2}/;

function isStartofWeek(d: DateTime) {
  return d.startOf("week").day + 6 === d.day;
}

function isStartOfMonth(d: DateTime) {
  return d.startOf("month").toISODate() === d.toISODate();
}

function isStartOfYear(d: DateTime) {
  return d.startOf("year").toISODate() === d.toISODate();
}

const shouldIndexDay = (file: PathStatsFile) => shouldIndex(file, "day");
const shouldIndexWeek = (file: PathStatsFile) => shouldIndex(file, "week");
const shouldIndexMonth = (file: PathStatsFile) => shouldIndex(file, "month");
const shouldIndexYear = (file: PathStatsFile) => shouldIndex(file, "year");

function getShouldFunc(unit: IJournal["unit"]) {
  switch (unit) {
    case "day":
      return shouldIndexDay;
    case "week":
      return shouldIndexWeek;
    case "month":
      return shouldIndexMonth;
    case "year":
      return shouldIndexYear;
  }
}

/**
 * Should we index a given file?
 *
 * @param file - A file yielded by our directory walking function
 * @param unit  - The journal "unit"
 */
function shouldIndex(file: PathStatsFile, unit: IJournal["unit"]): boolean {
  if (file.stats.isDirectory()) return false;

  const { ext, name } = path.parse(file.path);
  if (ext !== ".md") return false;
  if (name.startsWith(".")) return false;

  // Filename (without extension) must be a valid date
  const parsedDate = DateTime.fromISO(name);
  if (name !== parsedDate.toISODate()) return false;

  if (unit === "week") {
    if (!isStartofWeek(parsedDate)) return false;
  }

  if (unit === "month") {
    if (!isStartOfMonth(parsedDate)) return false;
  }

  if (unit === "year") {
    if (!isStartOfYear(parsedDate)) return false;
  }

  // const result = fileformat.exec('journals/foo/2020/02/2020-01-15.md')
  // Produces an array-like object:
  // [
  //   '/2020/02/2020-01-15',
  //   '2020',
  //   '02',
  //   '2020',
  //   '01',
  //   index: 17,
  //   input: 'journals/foo//2020/02/2020-01-15.md',
  //   groups: undefined
  // ]
  // NOTE: Its only array _like_, and only the matched segments
  const segments = fileformat.exec(file.path);

  // Is it in the correct directory structure?
  if (!segments) return false;
  if (segments.length !== 5) return false;

  // File should be in nested directories for its year and month
  if (segments[1] !== segments[3] || segments[2] !== segments[4]) return false;

  return true;
}
