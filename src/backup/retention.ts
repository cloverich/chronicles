/**
 * Tiered snapshot retention. Pure: `(timestamps, policy, now) -> keep set`.
 *
 * Keep the newest snapshot in each of the last N days, weeks, and months that
 * *have* snapshots (empty periods are not counted, so a quiet stretch never
 * ages out the last good copy), every snapshot taken on `now`'s day, and the
 * newest snapshot. All periods are UTC; weeks are ISO 8601 (Monday start).
 *
 * The same table of cases is tested in Engram; keep them identical.
 */

export interface RetentionPolicy {
  days: number;
  weeks: number;
  months: number;
}

export const DEFAULT_RETENTION: RetentionPolicy = {
  days: 5,
  weeks: 3,
  months: 3,
};

/** Why a snapshot is kept. One snapshot can satisfy several tiers. */
export type RetentionTier = "newest" | "today" | "day" | "week" | "month";

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function weekKey(d: Date): string {
  const midnight = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
  );
  const sinceMonday = (d.getUTCDay() + 6) % 7;
  return dayKey(new Date(midnight - sinceMonday * 86_400_000));
}

function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

/**
 * Returns the kept snapshots, keyed by epoch milliseconds, with the tiers each
 * satisfies. Anything absent from the result may be pruned.
 */
export function retain(
  timestamps: readonly Date[],
  policy: RetentionPolicy,
  now: Date,
): Map<number, RetentionTier[]> {
  const kept = new Map<number, RetentionTier[]>();
  const mark = (t: number, tier: RetentionTier) => {
    const tiers = kept.get(t) ?? [];
    if (!tiers.includes(tier)) tiers.push(tier);
    kept.set(t, tiers);
  };

  const newestFirst = [...new Set(timestamps.map((d) => d.getTime()))].sort(
    (a, b) => b - a,
  );
  if (newestFirst.length === 0) return kept;

  mark(newestFirst[0], "newest");

  const today = dayKey(now);
  for (const t of newestFirst) {
    if (dayKey(new Date(t)) === today) mark(t, "today");
  }

  const tiers: [RetentionTier, number, (d: Date) => string][] = [
    ["day", policy.days, dayKey],
    ["week", policy.weeks, weekKey],
    ["month", policy.months, monthKey],
  ];
  for (const [tier, limit, keyOf] of tiers) {
    const seen = new Set<string>();
    for (const t of newestFirst) {
      if (seen.size >= limit) break;
      const key = keyOf(new Date(t));
      if (seen.has(key)) continue;
      seen.add(key);
      mark(t, tier);
    }
  }

  return kept;
}
