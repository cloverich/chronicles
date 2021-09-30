import { RouterContext } from "@koa/router";
import settings from "electron-settings";

/**
 * The Preferences handler provides an API into electron-settings.
 */
export class PreferencesHandler {
  get = async ({ response }: RouterContext) => {
    response.status = 200;
    response.body = {
      ...settings.getSync(),
      // The schema.prisma file declares this environment variable as
      // where it looks for the database, and its provided by the start-up
      // process
      // todo: this collides with the database url from settings. Make this
      // behavior more transparent in the UI and this API (i.e. expose both,
      // make it clear the environment variable is the active one and the settings
      // file is the source of truth on start-up)
      DATABASE_URL: process.env["DATABASE_URL"],
    };
  };
}
