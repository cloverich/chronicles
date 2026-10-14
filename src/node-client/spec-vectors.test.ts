import { eq } from "drizzle-orm";
import fs from "fs";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { tmpdir } from "os";
import path from "path";
import { fileURLToPath } from "url";
import { SourceType } from "../preload/client/importer/SourceType";
import { deriveData } from "./derive";
import { extractArchive, writeArchive } from "./export-archive";
import { createClient } from "./factory";
import * as schema from "./schema";

/**
 * Runs the language-neutral vectors in `spec/vectors/`. Set
 * UPDATE_VECTORS=1 to regenerate expected outputs from the current
 * implementation — then review the diff by hand before committing.
 */

const SPEC_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../spec/vectors",
);
const UPDATE = process.env.UPDATE_VECTORS === "1";

interface ExportVectorInput {
  /** Journal IDs to export (a partial export); every journal when absent. */
  exportJournals?: string[];
  journals: { id: string; name: string; archivedAt: string | null }[];
  attachments: { ext: string; base64: string }[];
  notes: {
    id: string;
    journal: string;
    title: string | null;
    createdAt: string;
    updatedAt: string;
    tags: string[];
    frontMatter: Record<string, unknown>;
    content: string;
  }[];
}

/** Every file under dir, relative, sorted; export-info.json is not canonical. */
function listTree(dir: string): string[] {
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name !== "export-info.json")
    .map((e) =>
      path.relative(dir, path.join(e.parentPath, e.name)).replace(/\\/g, "/"),
    )
    .sort();
}

function assertSameTree(actualDir: string, expectedDir: string) {
  assert.deepStrictEqual(listTree(actualDir), listTree(expectedDir));
  for (const rel of listTree(expectedDir)) {
    const actual = fs.readFileSync(path.join(actualDir, rel));
    const expected = fs.readFileSync(path.join(expectedDir, rel));
    assert.ok(
      actual.equals(expected),
      `${rel} differs:\n${actual.toString("utf8")}`,
    );
  }
}

async function loadExportInput(input: ExportVectorInput, notesDir: string) {
  const client = await createClient({ dbPath: ":memory:", notesDir });
  for (const j of input.journals) {
    const updated = client.db
      .update(schema.journals)
      .set({ id: j.id, archivedAt: j.archivedAt })
      .where(eq(schema.journals.name, j.name))
      .run();
    if (updated.changes === 0) {
      await client.journals.index(j.name, j.id);
      client.db
        .update(schema.journals)
        .set({ archivedAt: j.archivedAt })
        .where(eq(schema.journals.id, j.id))
        .run();
    }
  }
  for (const a of input.attachments) {
    await client.files.attachments.putBytes(Buffer.from(a.base64, "base64"), {
      ext: a.ext,
    });
  }
  for (const n of input.notes) {
    await client.documents.importDocument({
      id: n.id,
      journal: n.journal,
      title: n.title ?? undefined,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      tags: n.tags,
      content: n.content,
      frontMatter: n.frontMatter,
    });
  }
  return client;
}

describe("spec/vectors/export", () => {
  const exportDir = path.join(SPEC_DIR, "export");
  for (const name of fs.readdirSync(exportDir)) {
    test(name, async () => {
      const caseDir = path.join(exportDir, name);
      const expectedDir = path.join(caseDir, "expected");
      const input: ExportVectorInput = JSON.parse(
        fs.readFileSync(path.join(caseDir, "input.json"), "utf8"),
      );

      const work = fs.mkdtempSync(path.join(tmpdir(), "chronicles-vector-"));
      try {
        const client = await loadExportInput(input, path.join(work, "notes"));
        const opts = { journals: input.exportJournals };
        const out = path.join(work, "out");
        await client.export.export(out, opts);

        if (UPDATE) {
          fs.rmSync(expectedDir, { recursive: true, force: true });
          fs.cpSync(out, expectedDir, { recursive: true });
          fs.rmSync(path.join(expectedDir, "export-info.json"));
        }

        assertSameTree(out, expectedDir);

        // The single-file form holds the same tree.
        const zip = path.join(work, "out.chronicles.zip");
        await client.export.export(zip, { ...opts, format: "archive" });
        const unzipped = path.join(work, "unzipped");
        fs.mkdirSync(unzipped);
        await extractArchive(zip, unzipped);
        assert.ok(fs.existsSync(path.join(unzipped, "export-info.json")));
        assertSameTree(unzipped, expectedDir);

        // The expected tree is itself an import input: importing it into an
        // empty library and exporting again must reproduce it exactly.
        const reimported = await createClient({
          dbPath: ":memory:",
          notesDir: path.join(work, "notes2"),
        });
        await reimported.importer.import(expectedDir, SourceType.Chronicles);
        const out2 = path.join(work, "out2");
        await reimported.export.export(out2, opts);
        assertSameTree(out2, expectedDir);
      } finally {
        fs.rmSync(work, { recursive: true, force: true });
      }
    });
  }
});

/**
 * `archive/<case>/*.chronicles.zip` are reader fixtures for the single-file
 * form: each extracts to `export/<case>/expected` (plus export-info.json).
 * The contract is the extracted tree, so a fixture is rewritten only when
 * its tree no longer matches, never for archive-byte churn.
 */
describe("spec/vectors/archive", () => {
  const archiveDir = path.join(SPEC_DIR, "archive");
  const fixtures: { name: string; forceZip64: boolean }[] = [
    { name: "writer.chronicles.zip", forceZip64: false },
    { name: "zip64.chronicles.zip", forceZip64: true },
  ];
  for (const caseName of fs.readdirSync(archiveDir)) {
    for (const { name, forceZip64 } of fixtures) {
      test(`${caseName}/${name}`, async () => {
        const expectedDir = path.join(SPEC_DIR, "export", caseName, "expected");
        const fixture = path.join(archiveDir, caseName, name);
        const work = fs.mkdtempSync(path.join(tmpdir(), "chronicles-archive-"));
        try {
          const extract = async () => {
            const dir = fs.mkdtempSync(path.join(work, "x-"));
            await extractArchive(fixture, dir);
            return dir;
          };
          if (UPDATE) {
            let stale = !fs.existsSync(fixture);
            if (!stale) {
              try {
                assertSameTree(await extract(), expectedDir);
              } catch {
                stale = true;
              }
            }
            if (stale) {
              const tree = path.join(work, "tree");
              fs.cpSync(expectedDir, tree, { recursive: true });
              fs.writeFileSync(
                path.join(tree, "export-info.json"),
                JSON.stringify(
                  { exportedAt: "2024-01-01T00:00:00.000Z" },
                  null,
                  2,
                ) + "\n",
              );
              fs.rmSync(fixture, { force: true });
              await writeArchive(tree, fixture, {
                forceZip64,
                mtime: new Date("2024-01-01T00:00:00.000Z"),
              });
            }
          }
          const dir = await extract();
          assert.ok(fs.existsSync(path.join(dir, "export-info.json")));
          assertSameTree(dir, expectedDir);

          // An archive imports like its folder.
          const client = await createClient({
            dbPath: ":memory:",
            notesDir: path.join(work, "notes"),
          });
          await client.importer.import(fixture, SourceType.Chronicles);
          const out = path.join(work, "out");
          await client.export.export(out);
          assertSameTree(out, expectedDir);
        } finally {
          fs.rmSync(work, { recursive: true, force: true });
        }
      });
    }
  }
});

describe("spec/vectors/derive", () => {
  const deriveDir = path.join(SPEC_DIR, "derive");
  for (const file of fs.readdirSync(deriveDir)) {
    const filePath = path.join(deriveDir, file);
    const cases: {
      name: string;
      title: string | null;
      markdown: string;
      expected: unknown;
    }[] = JSON.parse(fs.readFileSync(filePath, "utf8"));

    if (UPDATE) {
      for (const c of cases) {
        c.expected = deriveData({ title: c.title, content: c.markdown });
      }
      fs.writeFileSync(filePath, JSON.stringify(cases, null, 2) + "\n");
    }

    for (const c of cases) {
      test(`${file}: ${c.name}`, () => {
        assert.deepStrictEqual(
          deriveData({ title: c.title, content: c.markdown }),
          c.expected,
        );
      });
    }
  }
});
