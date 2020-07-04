import { Application, Router } from "https://deno.land/x/oak@v5.3.1/mod.ts";
import handlers from "./handlers.ts";

// Bootstrap server
const app = new Application();
const router = new Router();
const port = 8001;

// Misc middlewares

// CORS
app.use(async (ctx, next) => {
  // TODO: Is this the simplest configuration?
  ctx.response.headers.set("Access-Control-Allow-Origin", "*");
  ctx.response.headers.set("Access-Control-Allow-Headers", `*`);
  ctx.response.headers.set(
    "Access-Control-Allow-Methods",
    `POST, GET, OPTIONS, DELETE`
  );

  await next();
});

// Log response time
app.use(async (ctx, next) => {
  await next();
  const rt = ctx.response.headers.get("X-Response-Time");
  console.log(`${ctx.request.method} ${ctx.request.url} - ${rt}`);
});

// Timing
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  ctx.response.headers.set("X-Response-Time", `${ms}ms`);
});

// Make routes
router.get("/journals", handlers.findJournals);
router.post("/journals", handlers.addJournal);
router.get("/journals/:journal/:date", handlers.fetchDoc);
router.post("/journals/:journal/:date", handlers.save);
router.post("/search", handlers.search);

app.use(router.routes());
app.use(router.allowedMethods());

console.log(`Server running on port ${port}`);
await app.listen({ port });
