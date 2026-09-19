import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { parseChangelog } from "./changelog";

describe("parseChangelog", () => {
  it("parses date-first entries grouped by release", () => {
    const releases = parseChangelog(`# Changelog

## Unreleased

- 2026-09-18 a1b2c3d Added a thing. <!-- commits: a1b2c3d000000000000000000000000000000000 -->

## 0.12.1 — 2026-03-02

- 2026-03-02 d4e5f6a Fixed [search](https://example.com/issue).`);

    assert.equal(releases.length, 2);
    assert.equal(releases[0].title, "Unreleased");
    assert.deepEqual(releases[0].entries[0], {
      date: "2026-09-18",
      sha: "a1b2c3d",
      parts: [{ kind: "text", value: "Added a thing." }],
    });
    assert.equal(releases[1].entries[0].parts[1].kind, "link");
  });

  it("rejects sha-first entries", () => {
    assert.throws(
      () =>
        parseChangelog(`# Changelog

## Unreleased

- a1b2c3d 2026-09-18 Wrong order.`),
      /Invalid changelog entry/,
    );
  });
});
