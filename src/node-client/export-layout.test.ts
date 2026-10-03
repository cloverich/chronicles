import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { assignJournalDirs, encodeLinkSegment } from "./export-layout";

describe("assignJournalDirs", () => {
  test("keeps safe names and sanitizes unsafe ones", () => {
    const dirs = assignJournalDirs([
      "work",
      "a:b",
      "trailing. ",
      "_private",
      "CON",
      "",
    ]);
    assert.strictEqual(dirs.get("work"), "work");
    assert.strictEqual(dirs.get("a:b"), "a_b");
    assert.strictEqual(dirs.get("trailing. "), "trailing");
    assert.strictEqual(dirs.get("_private"), "j_private");
    assert.strictEqual(dirs.get("CON"), "CON_");
    assert.strictEqual(dirs.get(""), "journal");
  });

  test("disambiguates collisions ignoring case, in code-point order", () => {
    const dirs = assignJournalDirs(["a?b", "a*b", "A_b"]);
    assert.strictEqual(dirs.get("A_b"), "A_b");
    assert.strictEqual(dirs.get("a*b"), "a_b-2");
    assert.strictEqual(dirs.get("a?b"), "a_b-3");
  });
});

describe("encodeLinkSegment", () => {
  test("encodes only destination-breaking characters", () => {
    assert.strictEqual(encodeLinkSegment("my journal"), "my%20journal");
    assert.strictEqual(encodeLinkSegment("a(b)%"), "a%28b%29%25");
    assert.strictEqual(encodeLinkSegment("日記"), "日記");
  });
});
