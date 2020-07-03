import { Application, Router } from "https://deno.land/x/oak@v5.3.1/mod.ts";
import handlers from "./handlers.ts";

// Bootstrap server
const app = new Application();
const router = new Router();
const port = 8001;

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
