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
} from "https://deno.land/x/oak@v5.3.1/mod.ts";

// Bootstrap services
const db = createDb("./pragma.db", true);
const journals = await Journals.create(db);
const finder = new DocsFinder(db, journals);
// Initializes journals. Stupid.
await journals.list();

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
      contentTypes: {
        text: ["application/json"],
      },
    });

    function assertBody() {
      if (!body.value) return "no body";
      if (!body.value.name) return "no body.name";
      if (!body.value.url) return "no body.url";
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
      name: body.value.name,
      url: body.value.url,
    });

    ctx.response.status = Status.OK;
  };

  // docs
  fetchDoc = async (ctx: RouterContext) => {
    const body = await ctx.request.body({
      contentTypes: {
        text: ["application/json"],
      },
    });

    if (!ctx.params.journal || !ctx.params.date) {
      ctx.response.status = Status.BadRequest;
      ctx.response.body = {
        title: "Journal and Date are required",
      };
    }

    const doc = await this.finder.fetchDoc(
      ctx.params.journal!,
      ctx.params.date!
    ); // could pass ctx.params...

    ctx.response.status = Status.OK;
    ctx.response.body = doc;
  };

  search = async (ctx: RouterContext) => {
    const body = await ctx.request.body({
      contentTypes: {
        text: ["application/json"],
      },
    });

    // DocsQuery
    // .journals and other keys are optional.. pass through?
    const docs = await this.finder.search(body.value);

    ctx.response.status = Status.OK;
    ctx.response.body = {
      query: body.value,
      docs,
    };
  };

  save = async (ctx: RouterContext) => {
    const { value } = await ctx.request.body({
      contentTypes: {
        text: ["application/json"],
      },
    });

    // todo validation and error helpers this is banananas
    function assertBody(): string | SaveRequest {
      if (!value) return "body empty";
      if (!ctx.params.journal) return "no journal specified";
      if (!ctx.params.journal) return "";
      if (!ctx.params.date) return "no date specified";

      if (value.raw) {
        return {
          journalName: ctx.params.journal,
          date: ctx.params.date,
          raw: value.raw,
        };
      }

      if (value.mdast) {
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

    await this.finder.save(saveRequest);
    // ideally, return server-side parsed content as mdast?
    // todo: update journal entries
  };
}

export default new Handlers(journals, finder);
