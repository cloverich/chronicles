import Koa from "koa";
import Router from "@koa/router";
const bodyParser = require("koa-bodyparser");
import { Handlers as Handlers2 } from "./handlers/index";
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

export async function server(handlers2: Handlers2) {
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
          title: (err as Error).message,
        };
      }
    }

    const ms = Date.now() - start;
    ctx.set("X-Response-Time", `${ms}ms`);
    console.log(
      `${ctx.request.method} ${ctx.response.status} ${ctx.request.url} - ${ms}`
    );
  });

  router.get("/v2/preferences", handlers2.preferences.get);

  router.get("/v2/journals", handlers2.journals.list);
  router.post("/v2/journals", handlers2.journals.create);
  router.delete("/v2/journals/:id", handlers2.journals.remove);

  router.get("/v2/documents/:id", handlers2.documents.findById);
  router.post("/v2/documents", handlers2.documents.save);

  // todo: not crazy about this URL, but /documents/search is overloaded
  // with documents/:id. Think about this later
  router.post("/v2/search", handlers2.documents.search);

  router.get("/v2/images/:key", handlers2.files.get);
  router.post("/v2/images", handlers2.files.upload);

  /**
   * This catch all route is for image requests.
   */
  router.get("(.*)", handlers2.files.getUnsafe);

  app.use(router.routes());
  app.use(router.allowedMethods());

  // Dynamically allocate a free port and listen
  const port = await makePort();
  console.log("listening on port", port);
  app.listen({ port });

  /**
   * Process.send only exists if started by a parent with
   * ipc, which we do when embedding in the electron app (but not test),
   * specifically so this process can
   * send a signal back indicating which port its attaching
   * to.
   */
  if (process.send) {
    process.send!(JSON.stringify({ name: "server_port", port }));
  }

  // so test can get the port:
  return { port };
}
