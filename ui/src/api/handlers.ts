import { Journals } from "./journals";
import { ValidationError } from "./errors";
import { Documents } from "./documents";
import { RouterContext } from "@koa/router";
import { SaveRequest } from "./documents";

export default class Handlers {
  private journals: Journals;
  private documents: Documents;

  constructor({
    journals,
    documents,
  }: {
    journals: Journals;
    documents: Documents;
  }) {
    this.journals = journals;
    this.documents = documents;
  }

  // journals
  findJournals = async ({ response }: RouterContext) => {
    response.status = 200;
    response.body = await this.journals.list();
  };

  addJournal = async (ctx: RouterContext) => {
    const body = ctx.request.body;

    function assertBody() {
      if (!body) return "no body";
      if (!("name" in body)) return "no body.name";
      if (!("url" in body)) return "no body.url";
      if ("period" in body) {
        if (!["day", "week", "month", "year"].includes(body.period)) {
          return 'body.period must be "day", "week", or "month", or "year"';
        }
      }
    }

    // ctx.response.headers.append("content-type", "application/json");
    const error = assertBody();
    if (error) {
      ctx.response.status = 400;
    }

    try {
      // idk what default is, maybe 10 seconds?
      // https://stackoverflow.com/questions/40138600/disable-request-timeout-in-koa;
      ctx.request.socket.setTimeout(60 * 1000);
      ctx.response.body = await this.journals.add({
        name: body.name,
        url: body.url,
        period: body.period || "day",
      });

      ctx.response.status = 200;
    } catch (err) {
      if (err instanceof ValidationError) {
        ctx.response.status = 400;
        ctx.response.body = {
          title: err.message,
        };
      } else {
        throw err;
      }
    }
  };

  removeJournal = async (ctx: RouterContext) => {
    const journal = ctx.params.journal;
    if (!journal) {
      ctx.response.status = 400;
      ctx.response.body = {
        title: "Invalid delete journal request",
      };
    }

    const remainingJournals = await this.journals.remove(journal);
    ctx.status = 200;
    ctx.response.body = remainingJournals;
  };

  // documents
  fetchDoc = async (ctx: RouterContext) => {
    if (!ctx.params.journal || !ctx.params.date) {
      ctx.response.status = 400;
      ctx.response.body = {
        title: "Journal and Date are required",
      };
    }

    try {
      const doc = await this.documents.fetchDoc(
        ctx.params.journal!,
        ctx.params.date!
      ); // could pass ctx.params....
      ctx.response.status = 200;
      ctx.response.body = doc;
    } catch (err) {
      if (err.name === "NotFound") {
        ctx.response.status = 404;
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
    const body = ctx.request!.body;
    const docs = await this.documents.search(body);

    ctx.response.status = 200;
    ctx.response.body = {
      query: body.value,
      docs,
    };
  };

  save = async (ctx: RouterContext) => {
    const value = ctx.request.body;

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
      ctx.response.status = 400;
      ctx.response.body = {
        title: "Journal and Date are required",
      };
      return;
    }

    const doc = await this.documents.save(saveRequest);
    ctx.response.body = doc;
    ctx.response.status = 200;
  };
}
