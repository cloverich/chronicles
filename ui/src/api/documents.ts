import { Database } from "./database";
import { Journals } from "./journals";
import { Files } from "./files";
import { parser, stringifier } from "../markdown";
import { Indexer } from "./indexer";

interface DocsQuery {
  // null means all journals, aka don't filter by journal name
  journals?: string[];

  // TODO: queries against raw document text,
  // aka grep
  // text: string | null;

  nodeMatch?: {
    type: string; // type of Node
    attributes: any; // match one or more attributes of the node, like depth for heading nodes
    text: string; // match raw text from within the node
  };
}

interface SaveRawRequest {
  journalName: string;
  date: string;
  raw: string;
}

interface SaveMdastRequest {
  journalName: string;
  date: string;
  mdast: any;
}

export type SaveRequest = SaveRawRequest | SaveMdastRequest;

// function isRaw(req: SaveRequest): is SaveRawRequest {

// }

// sprii

// A document filter is passed to the actual document request,
// and filters which parts of the mdast tree are returned
// ex: Only heading node
// ex: Only content under heading node
// ex: Only heading and content under heading node
// ex: only GFM list items
// ex: Only GFM list items that are / are not checked
interface Filter {}

/**
 * Docs knows how to take a parsed query and fetch document result
 * sets for it.
 */
export class Documents {
  private indexer: Indexer;
  constructor(private db: Database, private journals: Journals) {
    this.indexer = new Indexer(db); // todo: DI this as well
  }

  // private select = (
  //   sql: string,
  //   params: any /*Array<string | number | boolean> */
  // ): Array<any> => {
  //   return this.db.prepare(sql).raw(params);
  // };

  // Raw text is special: its just grep, it matches documents, returns a snippet of text
  searchText = () => {};

  // Find specific nodes and / or types. Different than others because it can return nodes directly,
  // instead of documents. But... how to merge matched nodes into a single document? Hmmm
  findNodes = () => {};

  /**
   * Take a query, get a set of matching documents.
   *
   * TODO: Make the results set here MUCH more compact, something like:
   * /journalname/date
   */
  search = (dq: DocsQuery): Array<[string, string]> => {
    const sql = this.makeQuery(dq);
    return this.db.prepare(sql).raw().all();
  };

  private makeQuery = (dq: DocsQuery): string => {
    const q = {
      select: `select distinct journal, date from nodes`,
      where: [] as string[],
    };

    if (dq.journals && dq.journals.length > 0) {
      if (dq.journals.length > 1) {
        q.where.push(
          `journal in (${dq.journals.map((journal) => `'${journal}'`)})`
        );
      } else {
        q.where.push(`journal = '${dq.journals[0]}'`);
      }
    }

    if (dq.nodeMatch) {
      throw new Error("searching documents by nodes not yet supported");
    }

    let finalQuery = q.select;
    if (q.where.length > 0) {
      finalQuery += " where " + q.where.join(" and ");
    }

    finalQuery += " order by date desc";

    return finalQuery;
  };

  fetchDoc = async (journalName: string, date: string) => {
    const url = this.journals.pathForJournal(journalName);
    const raw = await Files.read(Files.pathForEntry(url, date));
    return { raw, mdast: parser.parse(raw) };
  };

  save = async (req: SaveRequest) => {
    // save mdast or string? string is less risky but someone is serializing it...
    const jpath = this.journals.pathForJournal(req.journalName);
    if (!jpath)
      throw new Error(`Could not find url for journal ${req.journalName}`);

    // Handle both raw contents and mdast
    // TODO: Validate date structure (done in FileDAO)
    // TODO: Validate MDAST is in fact a reasonably sized MDAST
    // TODO: Does accepting raw content make sense? It has to be parsed here,
    // and if UI fails to parse it to mdast, do I really want to accept it?
    // NOTE: If I do accept mdast, I _am_ stringifying before storage... if
    // that ever has an issue it would be ummm disastrous. Hmmm...
    // TODO: Think about backups when overwriting
    if ("raw" in req) {
      await Files.save(jpath, req.date, req.raw);
      await this.indexer.indexNode(
        req.journalName,
        req.date,
        parser.parse(req.raw)
      );
    } else {
      const contents = stringifier.stringify(req.mdast);
      await Files.save(jpath, req.date, contents);
      await this.indexer.indexNode(req.journalName, req.date, req.mdast);
    }

    return this.fetchDoc(req.journalName, req.date);
  };
}
