import { bootstrapCli } from "./bootstrap.js";

async function main() {
  try {
    const client = bootstrapCli();
    const journals = await client.journals.list();
    console.log(JSON.stringify(journals, null, 2));
  } catch (error) {
    console.error("Smoke test failed:", error);
    process.exit(1);
  }
}

main();
