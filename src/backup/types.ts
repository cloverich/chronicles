/**
 * Renderer-safe backup types: no Node imports. The renderer sees only these
 * shapes — names, counts, times, and a display label for the destination.
 * Nothing here is a path the renderer can hand back to the main process.
 */
import type { RetentionTier } from "./retention";

export type { RetentionTier };

export type BackupTrigger = "activity" | "manual" | "install" | "pre-restore";

export interface SnapshotSummary {
  /** Directory name: the UTC stamp, e.g. 2026-09-22T14-25-34Z. */
  id: string;
  createdAt: string;
  trigger: BackupTrigger;
  appVersion: string;
  integrity: "ok";
  counts: Record<string, number>;
  databaseBytes: number;
  attachmentCount: number;
  attachmentBytes: number;
  /**
   * Retention tiers this snapshot satisfies right now. Always empty for
   * pre-restore snapshots, which sit outside the tiers (the most recent one
   * is kept).
   */
  tiers: RetentionTier[];
}

export interface BackupOutcome {
  at: string;
  trigger: BackupTrigger;
  snapshot?: string;
  error?: string;
}

export interface RestoreOutcome {
  at: string;
  snapshot: string;
  preRestoreSnapshot?: string;
  attachments?: { written: number; existing: number; missing: string[] };
  error?: string;
}

export interface BackupStatus {
  /** Display label for the chosen destination, or null when unset. */
  destination: string | null;
  lastSuccess: BackupOutcome | null;
  lastFailure: BackupOutcome | null;
  lastRestore: RestoreOutcome | null;
  pendingRestore: string | null;
  /** Against the newest regular snapshot; null when there is none. */
  changedSinceLastSnapshot: boolean | null;
  /** The newest regular (not pre-restore) snapshot. */
  newest: SnapshotSummary | null;
  /** Sync service holding the live database or attachments, if any. */
  liveDataInSyncFolder: string | null;
}

export type RunResult =
  | { status: "created"; snapshot: SnapshotSummary }
  | {
      status: "skipped";
      reason: "no-destination" | "recent" | "unchanged";
    };

export interface RestoreResult {
  snapshot: string;
  preRestoreSnapshot: string | null;
  attachments: { written: number; existing: number; missing: string[] };
}
