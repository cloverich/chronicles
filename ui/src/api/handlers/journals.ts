// import { Database, recreateSchema } from "./database";
// import { Indexer } from "./indexer";
// import { Files } from "./files";
import { ValidationError } from "../errors";
import { PrismaClient } from "@prisma/client";
// import { Journals } from "./journals";
// import { Documents } from "./documents";
import { RouterContext } from "@koa/router";
// import { SaveRequest } from "./documents";

export interface IJournal {
  // display name
  name: string;
}

/**
 * The Journals service knows how to CRUD journals and calls
 * out to index them when a new journal is added.
 */
export class Journals {
  private client: PrismaClient;

  constructor(client: PrismaClient) {
    this.client = client;
  }

  create = async (ctx: RouterContext) => {
    const body = ctx.request.body;

    function assertBody() {
      if (!body) return "no body";
      if (!("name" in body)) return "Journal name is required";
    }

    // ctx.response.headers.append("content-type", "application/json");
    const error = assertBody();
    if (error) {
      ctx.response.status = 400;
      ctx.response.body = {
        title: error,
      };
      return;
    }

    try {
      // idk what default is, maybe 10 seconds?
      // https://stackoverflow.com/questions/40138600/disable-request-timeout-in-koa;
      ctx.request.socket.setTimeout(60 * 1000);
      ctx.response.body = await this.client.journal2.create({
        data: {
          name: body.name,
        },
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

  remove = async (ctx: RouterContext) => {
    const journal = ctx.params.journal;
    if (!journal) {
      ctx.response.status = 400;
      ctx.response.body = {
        title: "Invalid delete journal request",
      };
    }

    const remainingJournals = await this.client.journal2.delete({
      where: { id: journal },
    });
    ctx.status = 200;
    ctx.response.body = remainingJournals;
  };

  list = async ({ response }: RouterContext) => {
    const body = await this.client.journal2.findMany();
    response.status = 200;
    response.body = body;
  };
}
