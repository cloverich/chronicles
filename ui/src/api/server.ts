import Koa from "koa";
import Router from "@koa/router";
import send from "koa-send";
const bodyParser = require("koa-bodyparser");
import Handlers from "./handlers";
// i hate myself
import makePort from "get-port";
import { ValidationError, NotFoundError } from "./errors";

/**
 * This process is started by the electron main process
 * as a background worker, but does not consistently get
 * killed when the parent dies.
 *
 * This sets up a listener to suicide if it loses connection
 * with the parent process, which might be more consistent.
 *
 * https://github.com/node-modules/graceful-process/blob/master/index.js
 */
process.on("disconnect", () => {
  console.log("server disconnected, shutting down");
  process.exit();
});

export async function server(handlers: Handlers) {
  const app = new Koa();
  app.use(bodyParser());
  const router = new Router();

  // Misc middlewares
  app.use(async (ctx, next) => {
    const start = Date.now();
    // CORS
    // TODO: Is this the simplest configuration?
    ctx.set("Access-Control-Allow-Origin", "*");
    ctx.set("Access-Control-Allow-Headers", `*`);
    ctx.set("Access-Control-Allow-Methods", `POST, PUT, GET, OPTIONS, DELETE`);

    try {
      await next();
    } catch (err) {
      console.error(err);
      if (err instanceof ValidationError) {
        ctx.response.status = 400;
        ctx.response.body = {
          title: err.message,
        };
      } else if (err instanceof NotFoundError) {
        ctx.response.status = 404;
        ctx.response.body = {
          title: err.message,
        };
      } else {
        ctx.response.status = 500;
        ctx.response.body = {
          title: err.message,
        };
      }
    }

    const ms = Date.now() - start;
    ctx.set("X-Response-Time", `${ms}ms`);
    console.log(
      `${ctx.request.method} ${ctx.response.status} ${ctx.request.url} - ${ms}`
    );
  });

  // Make routes
  router.get("/journals", handlers.findJournals);
  router.post("/journals", handlers.addJournal);
  router.delete("/journals/:journal", handlers.removeJournal);
  router.get("/journals/:journal/:date", handlers.fetchDoc);
  router.post("/journals/:journal/:date", handlers.save);
  router.post("/search", handlers.search);

  /**
   * This catch all route is for image requests.
   */
  router.get("(.*)", async (ctx) => {
    // Replace url encoded characters, ex: %20 -> space
    const url = decodeURI(ctx.request.path);

    // Any non-matched request lands here, and atttempts to
    // serve a file. Obviously a complete hack.
    // todo: verify request is for a known journal,
    // or re-write the file requests, or something
    // else in general
    await send(ctx, url, {
      root: "/",
    });
  });

  app.use(router.routes());
  app.use(router.allowedMethods());

  // Dynamically allocate a free port and listen
  const port = await makePort();
  app.listen({ port });

  /**
   * Process.send only exists if started by a parent with
   * ipc, which we do, specifically so this process can
   * send a signal back indicating which port its attaching
   * to.
   */
  process.send!(JSON.stringify({ name: "server_port", port }));
}
