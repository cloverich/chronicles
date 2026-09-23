import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  DEFAULT_RETENTION,
  retain,
  RetentionPolicy,
  RetentionTier,
} from "./retention";

function daily(from: string, to: string, time = "10:00:00Z"): string[] {
  const out: string[] = [];
  for (
    let d = new Date(`${from}T00:00:00Z`);
    d <= new Date(`${to}T00:00:00Z`);
    d = new Date(d.getTime() + 86_400_000)
  ) {
    out.push(`${d.toISOString().slice(0, 10)}T${time}`);
  }
  return out;
}

interface Case {
  name: string;
  snapshots: string[];
  now: string;
  policy?: RetentionPolicy;
  keep: string[];
}

// Keep this table identical to Engram's retention tests.
const cases: Case[] = [
  {
    name: "no snapshots",
    snapshots: [],
    now: "2026-09-23T12:00:00Z",
    keep: [],
  },
  {
    name: "a single old snapshot is the newest and is kept",
    snapshots: ["2024-01-01T00:00:00Z"],
    now: "2026-09-23T12:00:00Z",
    keep: ["2024-01-01T00:00:00Z"],
  },
  {
    name: "every snapshot from today is kept",
    snapshots: [
      "2026-09-23T01:00:00Z",
      "2026-09-23T05:00:00Z",
      "2026-09-23T09:00:00Z",
    ],
    now: "2026-09-23T12:00:00Z",
    keep: [
      "2026-09-23T01:00:00Z",
      "2026-09-23T05:00:00Z",
      "2026-09-23T09:00:00Z",
    ],
  },
  {
    name: "earlier days keep only their newest snapshot",
    snapshots: [
      "2026-09-22T01:00:00Z",
      "2026-09-22T05:00:00Z",
      "2026-09-23T01:00:00Z",
      "2026-09-23T05:00:00Z",
    ],
    now: "2026-09-23T12:00:00Z",
    keep: [
      "2026-09-22T05:00:00Z",
      "2026-09-23T01:00:00Z",
      "2026-09-23T05:00:00Z",
    ],
  },
  {
    name: "daily snapshots collapse to 5 days, 3 weeks, 3 months",
    snapshots: daily("2026-07-01", "2026-09-23"),
    now: "2026-09-23T12:00:00Z",
    keep: [
      "2026-07-31T10:00:00Z", // month: July
      "2026-08-31T10:00:00Z", // month: August
      "2026-09-13T10:00:00Z", // week of Sep 7
      "2026-09-19T10:00:00Z", // days
      "2026-09-20T10:00:00Z", // day; week of Sep 14
      "2026-09-21T10:00:00Z",
      "2026-09-22T10:00:00Z",
      "2026-09-23T10:00:00Z", // newest, today, day, week, month
    ],
  },
  {
    name: "quiet stretches do not age out the last copies",
    snapshots: [
      "2025-01-10T10:00:00Z",
      "2025-06-01T10:00:00Z",
      "2026-03-15T10:00:00Z",
    ],
    now: "2026-09-23T12:00:00Z",
    keep: [
      "2025-01-10T10:00:00Z",
      "2025-06-01T10:00:00Z",
      "2026-03-15T10:00:00Z",
    ],
  },
  {
    name: "only periods with snapshots count toward a tier",
    snapshots: [
      "2026-01-05T10:00:00Z",
      "2026-02-05T10:00:00Z",
      "2026-03-05T10:00:00Z",
      "2026-04-05T10:00:00Z",
      "2026-05-05T10:00:00Z",
      "2026-06-05T10:00:00Z",
      "2026-06-06T10:00:00Z",
    ],
    now: "2026-09-23T12:00:00Z",
    policy: { days: 2, weeks: 0, months: 3 },
    keep: [
      "2026-04-05T10:00:00Z",
      "2026-05-05T10:00:00Z",
      "2026-06-05T10:00:00Z",
      "2026-06-06T10:00:00Z",
    ],
  },
  {
    name: "weeks start on Monday (UTC)",
    snapshots: [
      "2026-09-14T00:00:00Z", // Monday
      "2026-09-20T23:59:59Z", // Sunday, same week
      "2026-09-21T00:00:00Z", // Monday, next week
    ],
    now: "2026-09-30T12:00:00Z",
    policy: { days: 0, weeks: 2, months: 0 },
    keep: ["2026-09-20T23:59:59Z", "2026-09-21T00:00:00Z"],
  },
  {
    name: "ISO weeks span the year boundary",
    snapshots: [
      "2025-12-28T10:00:00Z", // Sunday, week of Dec 22
      "2025-12-29T10:00:00Z", // Monday, 2026-W01
      "2026-01-01T10:00:00Z", // Thursday, 2026-W01
    ],
    now: "2026-01-20T12:00:00Z",
    policy: { days: 0, weeks: 2, months: 0 },
    keep: ["2025-12-28T10:00:00Z", "2026-01-01T10:00:00Z"],
  },
  {
    name: "the newest is kept even when every tier is empty",
    snapshots: ["2026-09-01T10:00:00Z", "2026-09-02T10:00:00Z"],
    now: "2026-09-23T12:00:00Z",
    policy: { days: 0, weeks: 0, months: 0 },
    keep: ["2026-09-02T10:00:00Z"],
  },
];

describe("retain", () => {
  for (const c of cases) {
    test(c.name, () => {
      const kept = retain(
        c.snapshots.map((s) => new Date(s)),
        c.policy ?? DEFAULT_RETENTION,
        new Date(c.now),
      );
      const keptIso = [...kept.keys()]
        .sort((a, b) => a - b)
        .map((t) => new Date(t).toISOString().replace(".000Z", "Z"));
      assert.deepEqual(keptIso, [...c.keep].sort());
    });
  }

  test("reports every tier a snapshot satisfies", () => {
    const snapshots = daily("2026-07-01", "2026-09-23").map((s) => new Date(s));
    const kept = retain(
      snapshots,
      DEFAULT_RETENTION,
      new Date("2026-09-23T12:00:00Z"),
    );
    const tiersOf = (iso: string) =>
      [...(kept.get(new Date(iso).getTime()) ?? [])].sort();

    assert.deepEqual(tiersOf("2026-09-23T10:00:00Z"), [
      "day",
      "month",
      "newest",
      "today",
      "week",
    ] satisfies RetentionTier[]);
    assert.deepEqual(tiersOf("2026-09-20T10:00:00Z"), ["day", "week"]);
    assert.deepEqual(tiersOf("2026-08-31T10:00:00Z"), ["month"]);
  });

  test("does not depend on input order or duplicates", () => {
    const a = daily("2026-08-01", "2026-09-23").map((s) => new Date(s));
    const b = [...a].reverse().concat(a.slice(0, 3));
    const now = new Date("2026-09-23T12:00:00Z");
    assert.deepEqual(
      [...retain(a, DEFAULT_RETENTION, now).keys()].sort(),
      [...retain(b, DEFAULT_RETENTION, now).keys()].sort(),
    );
  });
});
