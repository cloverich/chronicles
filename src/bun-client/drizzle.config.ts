import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/bun-client/schema.ts",
  out: "./src/bun-client/migrations",
  dialect: "sqlite",
});
