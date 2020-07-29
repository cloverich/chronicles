import Koa from "koa";
import Router from "@koa/router";
import send from "koa-send";
const bodyParser = require("koa-bodyparser");
import Handlers from "./handlers";

export async function server(handlers: Handlers) {
  const app = new Koa();
  app.use(bodyParser());
  const router = new Router();
  const port = 8001;

  // Misc middlewares
  app.use(async (ctx, next) => {
    try {
      await next();
    } catch (err) {
      console.error("error handling", ctx.request.path);
      console.error(err);
      ctx.response.status = 500;
    }
  });

  // CORS
  app.use(async (ctx, next) => {
    // TODO: Is this the simplest configuration?
    ctx.set("Access-Control-Allow-Origin", "*");
    ctx.set("Access-Control-Allow-Headers", `*`);
    ctx.set("Access-Control-Allow-Methods", `POST, PUT, GET, OPTIONS, DELETE`);
    await next();
  });

  // Log response time
  app.use(async (ctx, next) => {
    await next();
    const rt = ctx.get("X-Response-Time");
    console.log(
      `${ctx.request.method} ${ctx.response.status} ${ctx.request.url} - ${rt}`
    );
  });

  // Timing
  app.use(async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    ctx.set("X-Response-Time", `${ms}ms`);
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

  console.log(`Server running on port ${port}`);
  app.listen({ port });
}
