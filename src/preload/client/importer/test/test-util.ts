import fs from "fs";
import { tmpdir } from "os";
import path from "path";

import migrate from "../../../../electron/migrations/index.js";
import store from "../../../../electron/settings.js";
import { mkdirp, walk } from "../../../utils/fs-utils.js";
import { createClient } from "../../factory.js";
import { IClient } from "../../types.js";

export interface GenerateFileOptions {
  filePath: string;
  fileType: "mov" | "jpg" | "png" | "pdf" | "csv" | "webp";
}

const filetypes = ["mov", "jpg", "png", "pdf", "csv", "webp"];

export type Client = Omit<IClient, "tests">;

export interface ISetupResponse {
  // client with a temp database, settings, and notes directory
  client: Client;
  // import test directory
  testdir: string;
  // knex instance for direct database queries in tests
  knex: ReturnType<typeof createClient>["knex"];
}

function testDir() {
  return path.relative(process.cwd(), "src/preload/client/importer/test");
}

// clean image files from the test directory
export async function cleanup() {
  let count = 0;
  for await (const file of walk(testDir(), 4, () => true)) {
    if (filetypes.includes(path.extname(file.path).slice(1))) {
      count++;
      await fs.promises.unlink(file.path);
    }

    // sanity check
    if (count > 10) {
      throw new Error(
        "Attempted to delete too many files in test direcotry; something is wrong. Last file: " +
          file.path,
      );
    }
  }
}

export const generateFileStubs = async (stubs: GenerateFileOptions[]) => {
  await Promise.all(stubs.map(generateBinaryFileStub));
};

/**
 * Generates a small, valid file of the specified type; for testing linked files imported
 * alongside notes without having to track a bunch of binary files in Git.
 */
export const generateBinaryFileStub = async ({
  filePath,
  fileType,
}: GenerateFileOptions): Promise<void> => {
  // dumb: URLs in Notion documents are url encoded, but should not be on disk
  // and assumed not to be in importer usage
  filePath = decodeURIComponent(filePath);

  filePath = path.join(testDir(), filePath);
  const dir = path.dirname(filePath);

  // todo: only necessary if directory structure not pre setup.
  await mkdirp(dir);

  const ext = path.extname(filePath);
  if (ext !== `.${fileType}`) {
    throw new Error(`File extension does not match file type: ${fileType}`);
  }

  switch (fileType) {
    case "mov":
      fs.writeFileSync(filePath, Buffer.from("ftypisom", "utf-8")); // Minimal MOV header
      break;
    case "jpg":
      fs.writeFileSync(
        filePath,
        Buffer.from([
          0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00,
          0x01,
        ]),
      );
      break;
    case "png":
      fs.writeFileSync(
        filePath,
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      );
    case "pdf":
      fs.writeFileSync(filePath, Buffer.from("%PDF-1.4\n%âãÏÓ", "utf-8")); // Minimal PDF header
      break;
    case "csv":
      fs.writeFileSync(filePath, "column1,column2\nvalue1,value2"); // Basic CSV content
      break;
    case "webp":
      fs.writeFileSync(filePath, Buffer.from("RIFF" + "WEBP", "utf-8"));
      break;
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
};

// create a client with a temp database, settings, and notes directory
// for integration testing
export async function setup(): Promise<ISetupResponse> {
  store.clear();

  const tempDir = fs.mkdtempSync(path.join(tmpdir(), "chronicles-test-"));

  // Setup the test database URL and notes directory
  const dbUrl = path.join(tempDir, "test.db");
  const notesDir = path.join(tempDir, "notes");

  // Ensure the notes notesDirdirectory exists
  mkdirp(notesDir);

  store.set("notesDir", notesDir);
  store.set("databaseUrl", dbUrl);

  // Run database migrations directly
  try {
    migrate(dbUrl);
  } catch (err) {
    console.error("Database setup failed:", dbUrl, err);
    throw new Error("Database migration failed.");
  }

  const client = createClient({
    store,
  }) as Client;

  return { testdir: testDir(), client, knex: client.knex };
}
