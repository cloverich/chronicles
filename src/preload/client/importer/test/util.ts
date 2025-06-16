import DB from "better-sqlite3";
import { ipcRenderer } from "electron";
import Store from "electron-store";
import fs from "fs";
import KnexConstructor, { Knex } from "knex";
import { tmpdir } from "os";
import path from "path";
import util from "util";
import { IPreferences } from "../../../../hooks/stores/preferences";
import { Files } from "../../../files";
import { DocumentsClient } from "../../documents";
import { FilesClient } from "../../files";
import { ImporterClient } from "../../importer";
import { JournalsClient } from "../../journals";
import { PreferencesClient } from "../../preferences";
import { SyncClient } from "../../sync";
import { TagsClient } from "../../tags";
import { IClient } from "../../types";

export interface GenerateFileOptions {
  filePath: string;
  fileType: "mov" | "jpg" | "png" | "pdf" | "csv" | "webp";
}

const filetypes = ["mov", "jpg", "png", "pdf", "csv", "webp"];

export type Client = Omit<IClient, "tests">;

export interface ISetupResponse {
  // initialized knex client, for asserting import tables, etc
  knex: Knex;
  // client with a temp database, settings, and notes directory
  client: Client;
  // import test directory
  testdir: string;
}

function testDir() {
  return path.relative(process.cwd(), "src/preload/client/importer/test");
}

// clean image files from the test directory
export async function cleanup() {
  let count = 0;
  for await (const file of Files.walk(testDir(), 4, () => true)) {
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
  await Files.mkdirp(dir);

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
  const store = new Store<IPreferences>({
    name: "test",
  });
  store.clear();

  const tempDir = fs.mkdtempSync(path.join(tmpdir(), "chronicles-test-"));

  // Setup the test database URL and notes directory
  const dbUrl = path.join(tempDir, "test.db");
  const notesDir = path.join(tempDir, "notes");

  // Ensure the notes notesDirdirectory exists
  Files.mkdirp(notesDir);

  store.set("notesDir", notesDir);

  const { success, error } = await ipcRenderer.invoke("setup-database", dbUrl);

  if (!success) {
    console.error("Database setup failed:", dbUrl, error);
    throw new Error("Database migration failed.");
  }

  const db = DB(dbUrl);
  const knex = KnexConstructor({
    client: "better-sqlite3", // or 'better-sqlite3'
    connection: {
      filename: dbUrl,
    },
    // https://knexjs.org/guide/query-builder.html#insert
    // don't replace undefined with "DEFAULT" in insert statements; replace
    // it with NULL instead (SQLite raises otherwise)
    useNullAsDefault: true,
  });

  const preferences = new PreferencesClient(store);
  const files = new FilesClient(store);
  const journals = new JournalsClient(knex, files, preferences);
  const documents = new DocumentsClient(db, knex, files, preferences);
  const sync = new SyncClient(
    db,
    knex,
    journals,
    documents,
    files,
    preferences,
  );

  const importer = new ImporterClient(
    knex,
    documents,
    files,
    preferences,
    sync,
  );

  const client = {
    journals: journals,
    documents: documents,
    tags: new TagsClient(knex),
    preferences: preferences,
    files: files,
    sync,
    importer,
  };

  return { testdir: testDir(), client, knex };
}

// mocha setup + electron + esbuild -> fail. This is a workaround.
export const test = async (name: string, fn: () => void | Promise<void>) => {
  try {
    await fn();
    console.log(`✅ ${name}`);
  } catch (err) {
    console.error(`❌ ${name}`);
    console.error(util.inspect(err, { depth: 5 }));
  }
};

// find one by title, and raise helpfully if not found
export async function findByTitle(client: Client, title: string) {
  const docs = await client.documents.search({
    journals: [],
    titles: [title],
  });

  if (docs.data.length === 0) {
    throw new Error(`Document not found by title: ${title}`);
  }

  const doc = await client.documents.findById({ id: docs.data[0].id });
  if (!doc) {
    throw new Error(
      `Document not found by id: ${docs.data[0].id} (title: ${title})`,
    );
  }

  return doc;
}
