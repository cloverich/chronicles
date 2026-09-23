import React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type {
  BackupStatus,
  RetentionTier,
  SnapshotSummary,
} from "../../backup/types";
import { Button } from "../../components/Button";
import { IconButton } from "../../components/IconButton";
import Titlebar from "../../titlebar/macos";
import * as Base from "../layout";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

export function formatAge(iso: string, now: Date): string {
  const minutes = Math.max(
    0,
    Math.round((now.getTime() - new Date(iso).getTime()) / 60_000),
  );
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const TIER_ORDER: RetentionTier[] = ["newest", "today", "day", "week", "month"];

function formatTiers(tiers: RetentionTier[]): string {
  return TIER_ORDER.filter((t) => tiers.includes(t)).join(", ") || "—";
}

function formatCounts(counts: Record<string, number>): string {
  return Object.entries(counts)
    .map(([k, v]) => `${v} ${k}`)
    .join(", ");
}

function Row({ label, children }: React.PropsWithChildren<{ label: string }>) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="m-0 min-w-0">{children}</dd>
    </>
  );
}

export default function Backups() {
  const navigate = useNavigate();
  const [status, setStatus] = React.useState<BackupStatus | null>(null);
  const [snapshots, setSnapshots] = React.useState<SnapshotSummary[]>([]);
  const [busy, setBusy] = React.useState<null | "run" | "pick" | "restore">(
    null,
  );
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const [s, list] = await Promise.all([
        window.chronicles.backups.status(),
        window.chronicles.backups.list(),
      ]);
      setStatus(s);
      setSnapshots(list);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  async function act<T>(
    kind: "run" | "pick" | "restore",
    fn: () => Promise<T>,
  ): Promise<T | undefined> {
    setBusy(kind);
    try {
      return await fn();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
      await refresh();
    }
  }

  async function backUpNow() {
    const result = await act("run", () => window.chronicles.backups.runNow());
    if (result?.status === "created") {
      toast.success(`Snapshot ${result.snapshot.id} saved`);
    }
  }

  async function restore(snapshot: SnapshotSummary) {
    const ok = confirm(
      `Restore the snapshot from ${formatTime(snapshot.createdAt)}?\n\n` +
        "Chronicles will relaunch, snapshot your current notes, then replace them with this snapshot. Attachments missing from your notes folder are copied back; existing files are left alone.",
    );
    if (!ok) return;
    const result = await act("restore", () =>
      window.chronicles.backups.restore(snapshot.id),
    );
    if (result) toast.info("Restoring… Chronicles will relaunch.");
  }

  const now = new Date();
  const hasDestination = !!status?.destination;

  return (
    <Base.Container>
      <Titlebar className="pr-16">
        <IconButton
          variant="minimal"
          className="drag-none"
          icon="chevron-left"
          onClick={() => navigate("/documents")}
          aria-label="Back"
        />
      </Titlebar>
      <Base.TitlebarSpacer />
      <Base.ScrollContainer>
        <main className="mx-auto w-full max-w-5xl px-8 py-10">
          <h1 className="text-foreground-strong mb-2 text-3xl font-semibold">
            Backups
          </h1>
          <p className="text-muted-foreground mb-8 max-w-[600px] text-sm">
            Verified snapshots of the database and attachments, kept in a folder
            you choose — a sync-service folder such as iCloud Drive works well.
            Chronicles checks at launch and hourly, and takes a snapshot when
            the newest is over a day old and notes have changed.
          </p>

          {loadError && (
            <p className="text-destructive mb-6 font-mono text-sm">
              {loadError}
            </p>
          )}

          {status?.liveDataInSyncFolder && (
            <p className="text-destructive mb-6 max-w-[600px] text-sm">
              Your notes are stored inside {status.liveDataInSyncFolder}. Sync
              services can lock, evict, or conflict-copy a live database; move
              the notes folder somewhere local and keep only backups there.
            </p>
          )}

          <dl className="mb-6 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
            <Row label="Destination">
              {status?.destination ? (
                <code className="break-all">{status.destination}</code>
              ) : (
                <span className="text-muted-foreground">Not set</span>
              )}
            </Row>
            <Row label="Last success">
              {status?.lastSuccess ? (
                <span>
                  {formatTime(status.lastSuccess.at)}{" "}
                  <span className="text-muted-foreground">
                    ({formatAge(status.lastSuccess.at, now)},{" "}
                    {status.lastSuccess.trigger})
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground">Never</span>
              )}
            </Row>
            <Row label="Last failure">
              {status?.lastFailure ? (
                <span>
                  {formatTime(status.lastFailure.at)}{" "}
                  <span className="text-muted-foreground">
                    ({status.lastFailure.trigger})
                  </span>
                  <span className="text-destructive block font-mono text-xs break-words">
                    {status.lastFailure.error}
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground">None</span>
              )}
            </Row>
            <Row label="Changed since last snapshot">
              {status?.changedSinceLastSnapshot === null || status === null ? (
                <span className="text-muted-foreground">—</span>
              ) : status.changedSinceLastSnapshot ? (
                "Yes"
              ) : (
                "No"
              )}
            </Row>
            {status?.pendingRestore && (
              <Row label="Pending restore">
                <code>{status.pendingRestore}</code>{" "}
                <span className="text-muted-foreground">
                  (applies at next launch)
                </span>
              </Row>
            )}
            {status?.lastRestore && (
              <Row label="Last restore">
                <span>
                  <code>{status.lastRestore.snapshot}</code> at{" "}
                  {formatTime(status.lastRestore.at)}
                  {status.lastRestore.error ? (
                    <span className="text-destructive block font-mono text-xs break-words">
                      {status.lastRestore.error}
                    </span>
                  ) : (
                    <span className="text-muted-foreground block text-xs">
                      Previous state saved as{" "}
                      <code>{status.lastRestore.preRestoreSnapshot}</code>;{" "}
                      {status.lastRestore.attachments?.written ?? 0} attachments
                      restored
                      {(status.lastRestore.attachments?.missing.length ?? 0) >
                        0 &&
                        `, ${status.lastRestore.attachments!.missing.length} missing from the backup: ${status.lastRestore.attachments!.missing.join(", ")}`}
                    </span>
                  )}
                </span>
              </Row>
            )}
          </dl>

          <div className="mb-10 flex gap-2">
            <Button
              variant="default"
              loading={busy === "run"}
              disabled={!hasDestination || busy !== null}
              onClick={backUpNow}
            >
              Back up now
            </Button>
            <Button
              variant="ghost"
              loading={busy === "pick"}
              disabled={busy !== null}
              onClick={() =>
                act("pick", () => window.chronicles.backups.pickDestination())
              }
            >
              {hasDestination ? "Change destination…" : "Choose destination…"}
            </Button>
          </div>

          <h2 className="text-foreground-strong mb-3 text-lg font-medium">
            Snapshots
          </h2>
          {snapshots.length === 0 ? (
            <p className="text-muted-foreground font-mono text-sm">
              {hasDestination
                ? "No snapshots yet."
                : "Choose a destination to start backing up."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left font-mono text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-4 font-normal">Time</th>
                    <th className="py-1 pr-4 font-normal">Age</th>
                    <th className="py-1 pr-4 font-normal">Tier</th>
                    <th className="py-1 pr-4 font-normal">Size</th>
                    <th className="py-1 pr-4 font-normal">Counts</th>
                    <th className="py-1 pr-4 font-normal">Integrity</th>
                    <th className="py-1 pr-4 font-normal">Trigger</th>
                    <th className="py-1 font-normal">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map((s) => (
                    <tr key={s.id} className="border-border border-t">
                      <td className="py-1 pr-4 whitespace-nowrap" title={s.id}>
                        {formatTime(s.createdAt)}
                      </td>
                      <td className="py-1 pr-4 whitespace-nowrap">
                        {formatAge(s.createdAt, now)}
                      </td>
                      <td className="py-1 pr-4">{formatTiers(s.tiers)}</td>
                      <td
                        className="py-1 pr-4 whitespace-nowrap"
                        title={`database ${formatBytes(s.databaseBytes)}, ${s.attachmentCount} attachments ${formatBytes(s.attachmentBytes)}`}
                      >
                        {formatBytes(s.databaseBytes + s.attachmentBytes)}
                      </td>
                      <td className="py-1 pr-4">
                        {formatCounts(s.counts)}, {s.attachmentCount}{" "}
                        attachments
                      </td>
                      <td className="py-1 pr-4">{s.integrity}</td>
                      <td className="py-1 pr-4">{s.trigger}</td>
                      <td className="py-1 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy !== null}
                          onClick={() => restore(s)}
                          aria-label={`Restore ${s.id}`}
                        >
                          Restore…
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </Base.ScrollContainer>
    </Base.Container>
  );
}
