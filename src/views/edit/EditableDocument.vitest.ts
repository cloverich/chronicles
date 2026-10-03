import { describe, expect, it, vi } from "vitest";
import type { IClient } from "../../hooks/useClient";
import { EditableDocument } from "./EditableDocument";

function makeDoc(updateDocument: (req: any) => Promise<string>) {
  const client = { documents: { updateDocument } } as unknown as IClient;
  const doc = new EditableDocument(client, {
    id: "03awvyp9xobkv9t1jmmtiz0bp",
    journal: "work",
    content: "v0",
    revision: "rev-0",
    frontMatter: {
      tags: [],
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
  });
  doc.teardown?.();
  return doc;
}

describe("EditableDocument saves", () => {
  it("serializes saves and threads each revision into the next baseRevision", async () => {
    const seen: string[] = [];
    let n = 0;
    const updateDocument = vi.fn(async (req: any) => {
      seen.push(req.baseRevision);
      await new Promise((r) => setTimeout(r, 5));
      return `rev-${++n}`;
    });
    const doc = makeDoc(updateDocument);

    await Promise.all([(doc as any).persist(), (doc as any).persist()]);

    expect(seen).toEqual(["rev-0", "rev-1"]);
    expect(doc.revision).toBe("rev-2");
  });

  it("a failed save does not block the next one", async () => {
    const updateDocument = vi
      .fn()
      .mockRejectedValueOnce(new Error("[DOCUMENT_CONFLICT] stale"))
      .mockResolvedValueOnce("rev-1");
    const doc = makeDoc(updateDocument);

    await expect((doc as any).persist()).rejects.toThrow("DOCUMENT_CONFLICT");
    await (doc as any).persist();
    expect(doc.revision).toBe("rev-1");
  });
});
