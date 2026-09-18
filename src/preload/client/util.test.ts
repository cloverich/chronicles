import { assert } from "chai";
import { describe, test } from "node:test";
import { Uuid25 } from "uuid25";
import { createId } from "./util";

/** Extract the 48-bit unix_ts_ms field from a uuid25 string */
function tsOf(id: string): number {
  return Uuid25.parseUuid25(id)
    .toBytes()
    .slice(0, 6)
    .reduce((acc, b) => acc * 256 + b, 0);
}

describe("id generation", () => {
  test("it generates ids in order", () => {
    const ids = [createId(), createId(), createId()];

    assert.sameOrderedMembers(ids, ids.slice().sort());
  });

  test("it generates ids in order when timestamp provided", () => {
    const backwards = [
      createId(Date.parse("2024-01-01")),
      createId(Date.parse("2023-01-01")),
      createId(Date.parse("2022-01-01")),
    ];

    assert.sameOrderedMembers(
      backwards.slice().reverse(),
      backwards.slice().sort(),
    );
  });

  test("backfilled ids embed exactly the requested timestamp regardless of order", () => {
    const later = Date.parse("2024-06-01T12:00:00Z");
    const earlier = later - 5_000; // within the old 10s rollback window
    const a = createId(later);
    const b = createId(earlier);
    const c = createId(later);

    assert.equal(tsOf(a), later);
    assert.equal(tsOf(b), earlier);
    assert.equal(tsOf(c), later);
  });

  test("same timestamp yields distinct ids", () => {
    const ts = Date.parse("2024-06-01");
    const ids = new Set(Array.from({ length: 100 }, () => createId(ts)));
    assert.equal(ids.size, 100);
  });

  test("epoch is a valid timestamp, not 'now'", () => {
    assert.equal(tsOf(createId(0)), 0);
  });

  test("sub-ms timestamps are rounded", () => {
    assert.equal(tsOf(createId(1700000000000.4)), 1700000000000);
  });

  test("invalid timestamps throw", () => {
    assert.throws(() => createId(NaN), RangeError);
    assert.throws(() => createId(-1), RangeError);
    assert.throws(() => createId(Infinity), RangeError);
    assert.throws(() => createId(2 ** 48), RangeError);
  });
});
