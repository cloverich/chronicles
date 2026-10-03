import { eq } from "drizzle-orm";
import fs from "fs";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { tmpdir } from "os";
import path from "path";
import { fileURLToPath } from "url";
import { SourceType } from "../preload/client/importer/SourceType";
import { deriveData } from "./derive";
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
  journals: { id: string; name: string }[];
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
      .set({ id: j.id })
      .where(eq(schema.journals.name, j.name))
      .run();
    if (updated.changes === 0) await client.journals.index(j.name, j.id);
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
        const out = path.join(work, "out");
        await client.export.export(out);

        if (UPDATE) {
          fs.rmSync(expectedDir, { recursive: true, force: true });
          fs.cpSync(out, expectedDir, { recursive: true });
          fs.rmSync(path.join(expectedDir, "export-info.json"));
        }

        assertSameTree(out, expectedDir);

        // The expected tree is itself an import input: importing it into an
        // empty library and exporting again must reproduce it exactly.
        const reimported = await createClient({
          dbPath: ":memory:",
          notesDir: path.join(work, "notes2"),
        });
        await reimported.importer.import(expectedDir, SourceType.Chronicles);
        const out2 = path.join(work, "out2");
        await reimported.export.export(out2);
        assertSameTree(out2, expectedDir);
      } finally {
        fs.rmSync(work, { recursive: true, force: true });
      }
    });
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
