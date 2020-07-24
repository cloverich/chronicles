import { DocsFinder, SaveRequest } from "./documents/Docs.ts";
import { Journals } from "./documents/Journals.ts";
import { createDb } from "./documents/db.ts";

import {
  Request,
  Response,
  RouteParams,
  RouterContext,
  Status,
  // asssert
} from "https://deno.land/x/oak@v6.0.1/mod.ts";

// Bootstrap services
// todo: ENV based db url
const db = createDb("./pragma.db");
const journals = await Journals.create(db);
const finder = new DocsFinder(db, journals);

// Route middelware
interface R {
  params: RouteParams;
  request: Request;
  response: Response;
}

//
class Handlers {
  constructor(private journals: Journals, private finder: DocsFinder) {}

  // journals
  findJournals = async ({ response }: R) => {
    response.status = 200;
    response.body = await this.journals.list();
  };

  addJournal = async (ctx: RouterContext) => {
    const body = await ctx.request.body({
      type: "json",
    }).value;

    function assertBody() {
      if (!body) return "no body";
      if (!("name" in body)) return "no body.name";
      if (!("url" in body)) return "no body.url";
    }

    // ctx.response.headers.append("content-type", "application/json");
    const error = assertBody();
    if (error) {
      ctx.response.status = Status.BadRequest;
    }
    // How to send back JSON for error? Ugh.
    // ctx.assert(assertBody(), Status.BadRequest, {
    //   title: "Body must be a valid journal",
    // });

    ctx.response.body = await this.journals.add({
      name: body.name,
      url: body.url,
    });

    ctx.response.status = Status.OK;
  };

  // docs
  fetchDoc = async (ctx: RouterContext) => {
    if (!ctx.params.journal || !ctx.params.date) {
      ctx.response.status = Status.BadRequest;
      ctx.response.body = {
        title: "Journal and Date are required",
      };
    }

    try {
      const doc = await this.finder.fetchDoc(
        ctx.params.journal!,
        ctx.params.date!
      ); // could pass ctx.params....
      ctx.response.status = Status.OK;
      ctx.response.body = doc;
    } catch (err) {
      if (err.name === "NotFound") {
        ctx.response.status = Status.NotFound;
        ctx.response.body = {
          title: "Document not found. Maybe you need to create it?",
        };
      } else {
        console.error("[Handlers.fetchDoc] error fetching document", err);
        throw err;
      }
    }
  };

  search = async (ctx: RouterContext) => {
    const body = await ctx.request.body({
      type: "json",
    }).value;

    // DocsQuery
    // .journals and other keys are optional.. pass through?
    const docs = await this.finder.search(body);

    ctx.response.status = Status.OK;
    ctx.response.body = {
      query: body.value,
      docs,
    };
  };

  save = async (ctx: RouterContext) => {
    const value = await ctx.request.body({
      type: "json",
    }).value;

    // todo validation and error helpers this is banananas
    function assertBody(): string | SaveRequest {
      if (!value) return "body empty";
      if (!ctx.params.journal) return "no journal specified";
      if (!ctx.params.journal) return "";
      if (!ctx.params.date) return "no date specified";

      if ("raw" in value) {
        return {
          journalName: ctx.params.journal,
          date: ctx.params.date,
          raw: value.raw,
        };
      }

      if ("mdast" in value) {
        return {
          journalName: ctx.params.journal,
          date: ctx.params.date,
          mdast: value.mdast,
        };
      }

      throw new Error(
        `Missing document content in save request. Must include body.raw or body.mdast`
      );
    }

    const saveRequest = assertBody();
    if (typeof saveRequest === "string") {
      ctx.response.status = Status.BadRequest;
      ctx.response.body = {
        title: "Journal and Date are required",
      };
      return;
    }

    const doc = await this.finder.save(saveRequest);
    ctx.response.body = doc;
    ctx.response.status = 200;
  };
}

export default new Handlers(journals, finder);
