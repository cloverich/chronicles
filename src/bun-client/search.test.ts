import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { createClient } from "./factory";

let client: Awaited<ReturnType<typeof createClient>>;
let notesDir: string;

beforeAll(async () => {
  notesDir = mkdtempSync(tmpdir() + "/chronicles-search-test-");
  client = await createClient({ dbPath: ":memory:", notesDir });

  await client.journals.create({ name: "journal-a" });
  await client.journals.create({ name: "journal-b" });

  // doc1: journal-a, tags [alpha, beta], content about fishing
  await client.documents.createDocument({
    journal: "journal-a",
    content: "I went fishing by the river today",
    frontMatter: {
      title: "Fishing Trip",
      tags: ["alpha", "beta"],
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
  });

  // doc2: journal-a, tags [beta, gamma], content about cooking
  await client.documents.createDocument({
    journal: "journal-a",
    content: "Made a delicious pasta with tomato sauce",
    frontMatter: {
      title: "Cooking Pasta",
      tags: ["beta", "gamma"],
      createdAt: "2024-02-01T00:00:00.000Z",
      updatedAt: "2024-02-01T00:00:00.000Z",
    },
  });

  // doc3: journal-b, tags [alpha], content about hiking
  await client.documents.createDocument({
    journal: "journal-b",
    content: "Hiked up the mountain trail this morning",
    frontMatter: {
      title: "Mountain Hike",
      tags: ["alpha"],
      createdAt: "2024-03-01T00:00:00.000Z",
      updatedAt: "2024-03-01T00:00:00.000Z",
    },
  });

  // doc4: journal-b, no tags, content about reading
  await client.documents.createDocument({
    journal: "journal-b",
    content: "Finished reading a great novel about the ocean",
    frontMatter: {
      title: "Book Review",
      tags: [],
      createdAt: "2024-04-01T00:00:00.000Z",
      updatedAt: "2024-04-01T00:00:00.000Z",
    },
  });
});

afterAll(() => {
  rmSync(notesDir, { recursive: true, force: true });
});

describe("FTS5 text search", () => {
  test("finds matching docs by content", async () => {
    const res = await client.documents.search({ texts: ["fishing"] });
    expect(res.data).toHaveLength(1);
    expect(res.data[0].title).toBe("Fishing Trip");
  });

  test("finds matching docs by title", async () => {
    const res = await client.documents.search({ texts: ["pasta"] });
    expect(res.data).toHaveLength(1);
    expect(res.data[0].title).toBe("Cooking Pasta");
  });

  test("multiple terms are ANDed", async () => {
    // "mountain" AND "trail" both in doc3
    const res = await client.documents.search({
      texts: ["mountain", "trail"],
    });
    expect(res.data).toHaveLength(1);
    expect(res.data[0].title).toBe("Mountain Hike");
  });

  test("returns empty for non-matching text", async () => {
    const res = await client.documents.search({ texts: ["spaceship"] });
    expect(res.data).toHaveLength(0);
  });

  test("text search combined with journal filter", async () => {
    // "river" is only in journal-a doc, but let's also filter by journal-a
    const res = await client.documents.search({
      texts: ["river"],
      journals: ["journal-a"],
    });
    expect(res.data).toHaveLength(1);
    expect(res.data[0].title).toBe("Fishing Trip");

    // same text, wrong journal
    const res2 = await client.documents.search({
      texts: ["river"],
      journals: ["journal-b"],
    });
    expect(res2.data).toHaveLength(0);
  });

  test("text search combined with tag filter", async () => {
    // doc3 has "mountain" and tag "alpha"
    const res = await client.documents.search({
      texts: ["mountain"],
      tags: ["alpha"],
    });
    expect(res.data).toHaveLength(1);
    expect(res.data[0].title).toBe("Mountain Hike");
  });

  test("search on empty DB returns empty array", async () => {
    const emptyDir = mkdtempSync(tmpdir() + "/chronicles-empty-");
    const emptyClient = await createClient({
      dbPath: ":memory:",
      notesDir: emptyDir,
    });
    const res = await emptyClient.documents.search({ texts: ["anything"] });
    expect(res.data).toHaveLength(0);
    rmSync(emptyDir, { recursive: true, force: true });
  });
});

describe("tag filter", () => {
  test("include tags returns correct docs", async () => {
    const res = await client.documents.search({ tags: ["alpha"] });
    const titles = res.data.map((d) => d.title);
    expect(titles).toContain("Fishing Trip");
    expect(titles).toContain("Mountain Hike");
    expect(titles).not.toContain("Cooking Pasta");
    expect(titles).not.toContain("Book Review");
  });

  test("exclude tags removes matching docs", async () => {
    const res = await client.documents.search({
      exclude: { tags: ["gamma"] },
    });
    const titles = res.data.map((d) => d.title);
    expect(titles).toContain("Fishing Trip");
    expect(titles).toContain("Mountain Hike");
    expect(titles).toContain("Book Review");
    expect(titles).not.toContain("Cooking Pasta");
  });

  test("include + exclude tags combined", async () => {
    // alpha but not beta → only Mountain Hike (doc3)
    const res = await client.documents.search({
      tags: ["alpha"],
      exclude: { tags: ["beta"] },
    });
    expect(res.data).toHaveLength(1);
    expect(res.data[0].title).toBe("Mountain Hike");
  });
});

describe("date prefix filter", () => {
  test("year filter", async () => {
    const res = await client.documents.search({ date: "2024" });
    expect(res.data).toHaveLength(4);
  });

  test("year-month filter", async () => {
    const res = await client.documents.search({ date: "2024-03" });
    expect(res.data).toHaveLength(1);
    expect(res.data[0].title).toBe("Mountain Hike");
  });

  test("full date filter", async () => {
    const res = await client.documents.search({
      date: "2024-01-01",
    });
    expect(res.data).toHaveLength(1);
    expect(res.data[0].title).toBe("Fishing Trip");
  });
});

describe("journal filter", () => {
  test("narrows results to journal", async () => {
    const res = await client.documents.search({ journals: ["journal-b"] });
    const titles = res.data.map((d) => d.title);
    expect(titles).toContain("Mountain Hike");
    expect(titles).toContain("Book Review");
    expect(titles).not.toContain("Fishing Trip");
    expect(titles).not.toContain("Cooking Pasta");
  });

  test("exclude journals", async () => {
    const res = await client.documents.search({
      exclude: { journals: ["journal-a"] },
    });
    const titles = res.data.map((d) => d.title);
    expect(titles).toContain("Mountain Hike");
    expect(titles).toContain("Book Review");
    expect(titles).not.toContain("Fishing Trip");
  });
});

describe("FTS updated on document changes", () => {
  test("update doc updates FTS index", async () => {
    const [id] = await client.documents.createDocument({
      journal: "journal-a",
      content: "Original elephants roam the savanna",
      frontMatter: {
        title: "Safari",
        tags: [],
        createdAt: "2024-06-01T00:00:00.000Z",
        updatedAt: "2024-06-01T00:00:00.000Z",
      },
    });

    // Should find by original content
    let res = await client.documents.search({ texts: ["elephants"] });
    expect(res.data.some((d) => d.id === id)).toBe(true);

    // Update content
    await client.documents.updateDocument({
      id,
      journal: "journal-a",
      content: "Updated giraffes crossing the plains",
      frontMatter: {
        title: "Safari Updated",
        tags: [],
        createdAt: "2024-06-01T00:00:00.000Z",
        updatedAt: "2024-06-02T00:00:00.000Z",
      },
    });

    // Old term should not match
    res = await client.documents.search({ texts: ["elephants"] });
    expect(res.data.some((d) => d.id === id)).toBe(false);

    // New term should match
    res = await client.documents.search({ texts: ["giraffes"] });
    expect(res.data.some((d) => d.id === id)).toBe(true);
  });

  test("delete doc removes from FTS index", async () => {
    const [id] = await client.documents.createDocument({
      journal: "journal-a",
      content: "Unique kangaroo content for deletion test",
      frontMatter: {
        title: "Delete FTS Test",
        tags: [],
        createdAt: "2024-07-01T00:00:00.000Z",
        updatedAt: "2024-07-01T00:00:00.000Z",
      },
    });

    let res = await client.documents.search({ texts: ["kangaroo"] });
    expect(res.data.some((d) => d.id === id)).toBe(true);

    await client.documents.del(id, "journal-a");

    res = await client.documents.search({ texts: ["kangaroo"] });
    expect(res.data.some((d) => d.id === id)).toBe(false);
  });
});
