import { RouterContext } from "@koa/router";

/**
 * The Journals service knows how to CRUD journals and calls
 * out to index them when a new journal is added.
 */
export class PreferencesHandler {
  get = async ({ response }: RouterContext) => {
    response.status = 200;
    response.body = {
      ...{}, // todo: settings
      // The schema.prisma file declares this environment variable as
      // where it looks for the database, and its provided by the start-up
      // process
      DATABASE_URL: process.env["DATABASE_URL"],
    };
  };
}
