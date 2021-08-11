import { PrismaClient } from "@prisma/client";
import { RouterContext } from "@koa/router";
import { Prisma } from "@prisma/client";
import { parser, stringifier } from "../../markdown";

/**
 * The Journals service knows how to CRUD journals and calls
 * out to index them when a new journal is added.
 */
export class DocumentsHandler {
  private client: PrismaClient;

  constructor(client: PrismaClient) {
    this.client = client;
  }

  // documents
  findById = async (ctx: RouterContext) => {
    if (!ctx.params.id) {
      ctx.response.status = 400;
      ctx.response.body = {
        title: "Document id is required",
      };
    }

    const doc = await this.client.document2.findFirst({
      where: { id: ctx.params.id },
    });

    if (doc) {
      ctx.response.status = 200;
      ctx.response.body = doc;
    } else {
      ctx.response.status = 404;
      ctx.response.body = {
        title: "Document not found. Maybe you need to create it?",
      };
    }
  };

  search = async (ctx: RouterContext) => {
    const body = ctx.request.body;
    const journals = ctx.request.body.journals;

    let docs: any;
    if (journals && journals.length > 0) {
      // todo: validate journal names? What's the result if they are invalid?
      // no search results. Hrmph
      // todo: test -- search with invalid journal(s) returns no search results
      docs = await this.client.document2.findMany({
        where: {
          journalId: {
            in: journals,
          },
        },
        select: {
          id: true,
          createdAt: true,
          title: true,
          journalId: true,
        },
        orderBy: { createdAt: "desc" },
      });
    } else {
      docs = await this.client.document2.findMany({
        select: {
          id: true,
          createdAt: true,
          title: true, // todo: this comes out as [null] when empty. An array? WTF?
          journalId: true,
        },
        orderBy: { createdAt: "desc" },
      });
    }

    ctx.response.status = 200;
    ctx.response.body = {
      data: docs,
    };
  };

  save = async (ctx: RouterContext) => {
    const value = ctx.request.body;

    // todo validation and error helpers this is banananas
    function assertBody():
      | string
      | { journalId: string; content: string; title: string; id: string } {
      if (!value) return "body empty";
      if (!ctx.request.body.journalId) return "no journal id specified";
      if (!ctx.request.body.content) return "no contents specified";

      return {
        journalId: ctx.request.body.journalId,
        content: ctx.request.body.content,
        title: ctx.request.body.title,
        id: ctx.request.body.id,
      };

      // if ("raw" in value) {
      //   return {
      //     journalName: ctx.params.journal,
      //     date: ctx.params.date,
      //     raw: value.raw,
      //   };
      // }

      // if ("mdast" in value) {
      //   return {
      //     journalName: ctx.params.journal,
      //     date: ctx.params.date,
      //     mdast: value.mdast,
      //   };
      // }

      // throw new Error(
      //   `Missing document content in save request. Must include body.raw or body.mdast`
      // );
    }

    const saveRequest = assertBody();

    if (typeof saveRequest === "string") {
      ctx.response.status = 400;
      ctx.response.body = {
        title: "Journal and Date are required",
      };
      return;
    }

    const doc = await this.client.document2.create({
      data: saveRequest,
    });

    ctx.response.body = doc;
    ctx.response.status = 200;
  };
}

// interface DocsQuery {
//   // null means all journals, aka don't filter by journal name
//   journals?: string[];

//   // TODO: queries against raw document text,
//   // aka grep
//   // text: string | null;

//   nodeMatch?: {
//     type: string; // type of Node
//     // attributes?: any; // match one or more attributes of the node, like depth for heading nodes
//     text?: string; // match raw text from within the node
//     attributes?: Record<string, string | number>;
//   };
// }

// interface SaveRawRequest {
//   journalName: string;
//   date: string;
//   raw: string;
// }

// interface SaveMdastRequest {
//   journalName: string;
//   date: string;
//   mdast: any;
// }

// export type SaveRequest = SaveRawRequest | SaveMdastRequest;

// // function isRaw(req: SaveRequest): is SaveRawRequest {

// // }

// // sprii

// // A document filter is passed to the actual document request,
// // and filters which parts of the mdast tree are returned
// // ex: Only heading node
// // ex: Only content under heading node
// // ex: Only heading and content under heading node
// // ex: only GFM list items
// // ex: Only GFM list items that are / are not checked
// interface Filter {}

// /**
//  * Docs knows how to take a parsed query and fetch document result
//  * sets for it.
//  */
// export class Documents {
//   private indexer: Indexer;
//   constructor(private db: Database, private journals: Journals) {
//     this.indexer = new Indexer(db); // todo: DI this as well
//   }

//   // private select = (
//   //   sql: string,
//   //   params: any /*Array<string | number | boolean> */
//   // ): Array<any> => {
//   //   return this.db.prepare(sql).raw(params);
//   // };

//   // Raw text is special: its just grep, it matches documents, returns a snippet of text
//   searchText = () => {};

//   // Find specific nodes and / or types. Different than others because it can return nodes directly,
//   // instead of documents. But... how to merge matched nodes into a single document? Hmmm
//   findNodes = () => {};

//   /**
//    * Take a query, get a set of matching documents.
//    *
//    * TODO: Make the results set here MUCH more compact, something like:
//    * /journalname/date
//    */
//   search = (dq: DocsQuery): Array<[string, string]> => {
//     const sql = this.makeQuery(dq);
//     return this.db.prepare(sql).raw().all();
//   };

//   /**
//    * Construct a full SQL select statement from a DocsQuery
//    */
//   private makeQuery = (dq: DocsQuery): string => {
//     // buildable query object
//     const q = {
//       select: `select distinct journal, date from nodes`,
//       where: [] as string[],
//     };

//     // append journal clauses
//     if (dq.journals && dq.journals.length > 0) {
//       if (dq.journals.length > 1) {
//         q.where.push(
//           `journal in (${dq.journals.map((journal) => `'${journal}'`)})`
//         );
//       } else {
//         q.where.push(`journal = '${dq.journals[0]}'`);
//       }
//     }

//     // append node clause
//     if (dq.nodeMatch) {
//       q.where.push(`type = '${dq.nodeMatch.type}'`);
//       if (dq.nodeMatch.text) q.where.push(`contents = '${dq.nodeMatch.text}'`);
//       if (dq.nodeMatch.attributes) {
//         Object.keys(dq.nodeMatch.attributes).forEach((key) => {
//           const value = dq.nodeMatch?.attributes![key];

//           // If value is a string, wrap it in quotes
//           const sqlValue =
//             typeof value === "string" ? `'${value}'` : `${value}`;

//           // https://www.sqlite.org/json1.html
//           q.where.push(`json_extract(attributes, '$.${key}') = ${sqlValue}`);
//         });
//       }
//     }

//     let finalQuery = q.select;
//     if (q.where.length > 0) {
//       finalQuery += " where " + q.where.join(" and ");
//     }

//     finalQuery += " order by date desc";

//     return finalQuery;
//   };

//   fetchDoc = async (journalName: string, date: string) => {
//     const url = this.journals.pathForJournal(journalName);
//     const raw = await Files.read(Files.pathForEntry(url, date));
//     return { raw, mdast: parser.parse(raw) };
//   };

//   save = async (req: SaveRequest) => {
//     // save mdast or string? string is less risky but someone is serializing it...
//     const jpath = this.journals.pathForJournal(req.journalName);
//     if (!jpath)
//       throw new Error(`Could not find url for journal ${req.journalName}`);

//     // Handle both raw contents and mdast
//     // TODO: Validate date structure (done in FileDAO)
//     // TODO: Validate MDAST is in fact a reasonably sized MDAST
//     // TODO: Does accepting raw content make sense? It has to be parsed here,
//     // and if UI fails to parse it to mdast, do I really want to accept it?
//     // NOTE: If I do accept mdast, I _am_ stringifying before storage... if
//     // that ever has an issue it would be ummm disastrous. Hmmm...
//     // TODO: Think about backups when overwriting
//     if ("raw" in req) {
//       await Files.save(jpath, req.date, req.raw);
//       await this.indexer.indexNode(
//         req.journalName,
//         req.date,
//         parser.parse(req.raw)
//       );
//     } else {
//       const contents = stringifier.stringify(req.mdast);
//       await Files.save(jpath, req.date, contents);
//       await this.indexer.indexNode(req.journalName, req.date, req.mdast);
//     }

//     return this.fetchDoc(req.journalName, req.date);
//   };
// }
