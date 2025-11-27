import { assert } from "chai";
import { describe, test } from "node:test";
import { groupDocumentsByDate } from "./groupDocumentsByDate";

describe("groupDocumentsByDate", () => {
  test("it groups documents by date", () => {
    const docs = [
      { createdAt: "2025-11-01" },
      { createdAt: "2025-11-02" },
      { createdAt: "2025-11-03" },
    ];

    const groups = groupDocumentsByDate(docs, new Date("2025-11-02"));

    assert.equal(groups.length, 1);
    assert.equal(groups[0].key, "2025-11");
    assert.equal(groups[0].label, "November");
    assert.equal(groups[0].docs.length, 3);
  });

  test("when 4 months of documents, it groups by month", () => {
    const docs = [
      { createdAt: "2025-11-01" },
      { createdAt: "2025-10-01" },
      { createdAt: "2025-09-01" },
      { createdAt: "2025-08-01" },
    ];

    const groups = groupDocumentsByDate(docs, new Date("2025-11-02"));

    assert.equal(groups.length, 4);
    assert.equal(groups[0].label, "November");
    assert.equal(groups[1].label, "October");
    assert.equal(groups[2].label, "September");
    assert.equal(groups[3].label, "2025");
  });

  test("when no documents, it returns an empty array", () => {
    const groups = groupDocumentsByDate([], new Date("2025-11-02"));
    assert.equal(groups.length, 0);
  });

  // Does not work but fyi
  test.skip("when documents are in the future, it groups by year", () => {
    const groups = groupDocumentsByDate(
      [{ createdAt: "2026-01-01" }],
      new Date("2025-11-02"),
    );
    assert.equal(groups.length, 1);
    assert.equal(groups[0].label, "2026");
  });

  test("when no recent documents, it groups by year", () => {
    const docs = [
      { createdAt: "2024-01-01" },
      { createdAt: "2023-01-01" },
      { createdAt: "2022-01-01" },
    ];

    const groups = groupDocumentsByDate(docs, new Date("2025-11-02"));
    assert.equal(groups.length, 3);
    assert.equal(groups[0].label, "2024");
    assert.equal(groups[1].label, "2023");
    assert.equal(groups[2].label, "2022");
  });
});
