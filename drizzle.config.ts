import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/node-client/schema.ts",
  out: "./src/node-client/migrations",
  dialect: "sqlite",
});
