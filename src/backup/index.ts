/**
 * Chronicles backups: verified SQLite snapshots plus a content-addressed
 * attachment pool, written to `<picked>/chronicles/` in a folder the user
 * chose with the native picker (typically a sync-service folder).
 *
 * All backup logic lives in this module. The host supplies the database
 * queries (fingerprint, counts), the attachments directory, a folder picker,
 * and where to keep state. Callers get five verbs — status, pickDestination,
 * run, list, restore — plus the two halves of a deferred restore for hosts
 * that must close the database first. Format: code/docs/backup-format.md.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { isSameOrInside } from "../node-client/fs-guards";
import { syncFolderContaining } from "../node-client/sync-folders";
import {
  assertClosed,
  DatabaseQueries,
  vacuumInto,
  verifySnapshot,
  withReadOnly,
} from "./database";
import {
  checkWritable,
  DestinationHandle,
  handleFromPicker,
  parseHandle,
  resolveHandle,
} from "./destination";
import { acquireLock } from "./lock";
import {
  APP_DIR,
  createdAtFor,
  DATABASE_FILE,
  Manifest,
  MANIFEST_FILE,
  parseManifest,
  parseStamp,
  POOL_DIR,
  SNAPSHOTS_DIR,
  stampFor,
} from "./manifest";
import {
  adoptBareBlobs,
  blobFileName,
  collectGarbage,
  hashFile,
  ingestAttachments,
  materializeAttachments,
  tempName,
} from "./pool";
import {
  DEFAULT_RETENTION,
  retain,
  RetentionPolicy,
  RetentionTier,
} from "./retention";
import { readState, updateState } from "./state";
import type {
  BackupStatus,
  BackupTrigger,
  RestoreResult,
  RunResult,
  SnapshotSummary,
} from "./types";

export type * from "./types";

/** Activity snapshots happen at most once per this interval. */
export const ACTIVITY_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface BackupHost extends DatabaseQueries {
  appVersion: string;
  /** The live database file. */
  databasePath: string;
  /** The attachments directory; read on every run since it can change. */
  attachmentsDir: () => string;
  /** JSON file for the destination handle and run history. */
  stateFile: string;
  /** Native folder picker. Resolves null when cancelled. */
  pickFolder: () => Promise<string | null>;
  now?: () => Date;
  retention?: RetentionPolicy;
}

export interface Backups {
  status(): Promise<BackupStatus>;
  pickDestination(): Promise<BackupStatus>;
  run(trigger: Exclude<BackupTrigger, "pre-restore">): Promise<RunResult>;
  list(): Promise<SnapshotSummary[]>;
  /** Restores now. The caller guarantees the app has closed the database. */
  restore(snapshotId: string): Promise<RestoreResult>;
  /** Verifies a snapshot and records it to restore at next startup. */
  scheduleRestore(snapshotId: string): Promise<void>;
  /** Runs a scheduled restore; call at startup before opening the database. */
  applyPendingRestore(): Promise<RestoreResult | null>;
}

interface Located {
  id: string;
  dir: string;
  manifest: Manifest;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function createBackups(host: BackupHost): Backups {
  const now = () => host.now?.() ?? new Date();
  const policy = host.retention ?? DEFAULT_RETENTION;
  const hashCache = new Map<string, { sha256: string; bytes: number }>();
  // In-process queue; the lock file serializes across processes.
  let queue: Promise<unknown> = Promise.resolve();
  const serialized = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = queue.then(fn, fn);
    queue = next.catch(() => {});
    return next;
  };

  async function destination(): Promise<DestinationHandle | null> {
    return parseHandle((await readState(host.stateFile)).destination);
  }

  async function appDirOrThrow(): Promise<string> {
    const handle = await destination();
    if (!handle) {
      throw new Error("[BACKUP_NO_DESTINATION] Choose a backup folder first.");
    }
    const picked = resolveHandle(handle);
    await checkWritable(picked);
    return path.join(picked, APP_DIR);
  }

  async function readSnapshots(appDir: string): Promise<Located[]> {
    const root = path.join(appDir, SNAPSHOTS_DIR);
    let names: string[];
    try {
      names = await fs.promises.readdir(root);
    } catch (err: any) {
      if (err?.code === "ENOENT") return [];
      throw err;
    }
    const out: Located[] = [];
    for (const id of names) {
      if (!parseStamp(id)) continue;
      const dir = path.join(root, id);
      const raw = await fs.promises
        .readFile(path.join(dir, MANIFEST_FILE), "utf8")
        .catch(() => null);
      const manifest = raw === null ? null : parseManifest(raw, id);
      if (manifest) out.push({ id, dir, manifest });
    }
    return out.sort((a, b) => (a.id < b.id ? 1 : -1));
  }

  const isRegular = (l: Located) => l.manifest.trigger !== "pre-restore";

  /**
   * What retention keeps, by snapshot id. Tiers apply to regular snapshots
   * only; `retain` stays pure, so pre-restore snapshots are filtered out
   * first. The most recent pre-restore snapshot is kept beside the tiers and
   * never counts as newest, so a same-day restore cannot push out its source.
   */
  function keepSet(located: Located[]): Map<string, RetentionTier[]> {
    const regular = located.filter(isRegular);
    const tiers = retain(
      regular.map((l) => parseStamp(l.id)!),
      policy,
      now(),
    );
    const kept = new Map<string, RetentionTier[]>();
    for (const l of regular) {
      const t = tiers.get(parseStamp(l.id)!.getTime());
      if (t) kept.set(l.id, t);
    }
    // `located` is newest first.
    const preRestore = located.find((l) => !isRegular(l));
    if (preRestore) kept.set(preRestore.id, []);
    return kept;
  }

  /** The newest snapshot the activity check and status compare against. */
  function newestRegular(located: Located[]): Located | undefined {
    return located.find(isRegular);
  }

  function summarize(located: Located[]): SnapshotSummary[] {
    const kept = keepSet(located);
    return located.map(({ id, manifest: m }) => ({
      id,
      createdAt: m.createdAt,
      trigger: m.trigger,
      appVersion: m.appVersion,
      integrity: m.database.integrity,
      counts: m.database.counts,
      databaseBytes: m.database.bytes,
      attachmentCount: m.attachments.length,
      attachmentBytes: m.attachments.reduce((n, a) => n + a.bytes, 0),
      tiers: kept.get(id) ?? [],
    }));
  }

  function liveFingerprint(): string | null {
    if (!fs.existsSync(host.databasePath)) return null;
    return withReadOnly(host.databasePath, host.fingerprint);
  }

  /**
   * Prunes by retention, deletes invalid snapshot directories and stale temp
   * directories, then garbage-collects the pool. Runs only under the lock and
   * only after a verified publish.
   */
  async function prune(appDir: string, protect: Set<string>): Promise<void> {
    const root = path.join(appDir, SNAPSHOTS_DIR);
    const valid = await readSnapshots(appDir);
    const validIds = new Set(valid.map((l) => l.id));

    for (const name of await fs.promises.readdir(root)) {
      const isTemp = name.startsWith(".tmp-");
      const isInvalid = parseStamp(name) !== null && !validIds.has(name);
      if (isTemp || isInvalid) {
        await fs.promises.rm(path.join(root, name), {
          recursive: true,
          force: true,
        });
      }
    }

    const kept = keepSet(valid);
    const survivors: Located[] = [];
    for (const l of valid) {
      if (kept.has(l.id) || protect.has(l.id)) {
        survivors.push(l);
      } else {
        await fs.promises.rm(l.dir, { recursive: true, force: true });
      }
    }

    const poolDir = path.join(appDir, POOL_DIR);
    const referenced = survivors.flatMap((l) => l.manifest.attachments);
    await adoptBareBlobs(poolDir, referenced);
    await collectGarbage(poolDir, new Set(referenced.map(blobFileName)));
  }

  /** Writes, verifies, and publishes one snapshot. Caller holds the lock. */
  async function snapshot(
    appDir: string,
    trigger: BackupTrigger,
    protect: Set<string>,
  ): Promise<SnapshotSummary> {
    const root = path.join(appDir, SNAPSHOTS_DIR);
    const poolDir = path.join(appDir, POOL_DIR);
    await fs.promises.mkdir(root, { recursive: true });
    await fs.promises.mkdir(poolDir, { recursive: true });

    // Directory names are unique to the second; step forward on collision.
    let at = now();
    while (fs.existsSync(path.join(root, stampFor(createdAtFor(at))))) {
      at = new Date(at.getTime() + 1000);
    }
    const createdAt = createdAtFor(at);
    const id = stampFor(createdAt);
    const tmp = path.join(root, tempName(id));

    try {
      await fs.promises.mkdir(tmp);

      // Database first, attachments second: the worst case is an
      // unreferenced blob, never a note pointing at a missing file.
      const dbFile = path.join(tmp, DATABASE_FILE);
      vacuumInto(host.databasePath, dbFile);
      const { counts, fingerprint } = verifySnapshot(dbFile, host);
      const { sha256, bytes } = await hashFile(dbFile);

      const attachments = await ingestAttachments(
        host.attachmentsDir(),
        poolDir,
        hashCache,
      );

      const manifest: Manifest = {
        format: 1,
        app: APP_DIR,
        appVersion: host.appVersion,
        createdAt,
        trigger,
        fingerprint,
        database: {
          file: DATABASE_FILE,
          bytes,
          sha256,
          integrity: "ok",
          counts,
        },
        attachments,
      };
      // The manifest is written last; it is what makes a snapshot valid.
      await fs.promises.writeFile(
        path.join(tmp, MANIFEST_FILE),
        JSON.stringify(manifest, null, 2) + "\n",
      );
      await fs.promises.rename(tmp, path.join(root, id));
    } catch (err) {
      await fs.promises.rm(tmp, { recursive: true, force: true });
      throw err;
    }

    await prune(appDir, new Set([...protect, id]));
    return summarize(await readSnapshots(appDir)).find((s) => s.id === id)!;
  }

  async function record(
    trigger: BackupTrigger,
    result: { snapshot?: string; error?: string },
  ) {
    const outcome = { at: now().toISOString(), trigger, ...result };
    await updateState(host.stateFile, (s) =>
      result.error
        ? { ...s, lastFailure: outcome }
        : { ...s, lastSuccess: outcome },
    );
  }

  async function locate(appDir: string, id: string): Promise<Located> {
    if (!parseStamp(id)) {
      throw new Error(`[BACKUP_NOT_FOUND] No snapshot named ${id}.`);
    }
    const found = (await readSnapshots(appDir)).find((l) => l.id === id);
    if (!found) throw new Error(`[BACKUP_NOT_FOUND] No snapshot named ${id}.`);
    return found;
  }

  /** Re-verifies a snapshot's database against its manifest. */
  async function verifyLocated(file: string, manifest: Manifest) {
    const { sha256 } = await hashFile(file);
    if (sha256 !== manifest.database.sha256) {
      throw new Error(
        "[BACKUP_INTEGRITY] Snapshot database does not match its manifest.",
      );
    }
    verifySnapshot(file, host);
  }

  async function restoreLocked(
    appDir: string,
    id: string,
  ): Promise<RestoreResult> {
    const { dir, manifest } = await locate(appDir, id);
    await verifyLocated(path.join(dir, DATABASE_FILE), manifest);

    // Stage beside the live database so the swap is a same-volume rename.
    const liveDir = path.dirname(host.databasePath);
    for (const name of await fs.promises.readdir(liveDir)) {
      if (name.startsWith(".chronicles-restore-")) {
        await fs.promises.rm(path.join(liveDir, name), { force: true });
      }
    }
    const staged = path.join(
      liveDir,
      `.chronicles-restore-${crypto.randomBytes(6).toString("hex")}.db`,
    );

    try {
      await fs.promises.copyFile(path.join(dir, DATABASE_FILE), staged);
      await verifyLocated(staged, manifest);

      let preRestoreSnapshot: string | null = null;
      if (fs.existsSync(host.databasePath)) {
        const pre = await snapshot(appDir, "pre-restore", new Set([id]));
        preRestoreSnapshot = pre.id;
      }

      assertClosed(host.databasePath);
      await fs.promises.rename(staged, host.databasePath);

      const attachments = await materializeAttachments(
        manifest.attachments,
        path.join(appDir, POOL_DIR),
        host.attachmentsDir(),
      );
      return { snapshot: id, preRestoreSnapshot, attachments };
    } finally {
      await fs.promises.rm(staged, { force: true });
    }
  }

  async function withLock<T>(fn: (appDir: string) => Promise<T>): Promise<T> {
    const appDir = await appDirOrThrow();
    await fs.promises.mkdir(appDir, { recursive: true });
    const release = await acquireLock(appDir);
    try {
      return await fn(appDir);
    } finally {
      await release();
    }
  }

  const backups: Backups = {
    async status() {
      const state = await readState(host.stateFile);
      const handle = parseHandle(state.destination);
      let newest: SnapshotSummary | null = null;
      let changed: boolean | null = null;
      if (handle) {
        const appDir = path.join(resolveHandle(handle), APP_DIR);
        const located = await readSnapshots(appDir).catch(() => []);
        const latest = newestRegular(located);
        if (latest) {
          newest = summarize(located).find((s) => s.id === latest.id)!;
          const fp = liveFingerprint();
          changed = fp === null ? null : fp !== latest.manifest.fingerprint;
        }
      }
      return {
        destination: handle ? path.join(resolveHandle(handle), APP_DIR) : null,
        lastSuccess: state.lastSuccess ?? null,
        lastFailure: state.lastFailure ?? null,
        lastRestore: state.lastRestore ?? null,
        pendingRestore: state.pendingRestore ?? null,
        changedSinceLastSnapshot: changed,
        newest,
        liveDataInSyncFolder:
          syncFolderContaining(path.dirname(host.databasePath)) ??
          syncFolderContaining(host.attachmentsDir()),
      };
    },

    async pickDestination() {
      const picked = await host.pickFolder();
      if (!picked) return backups.status();

      const handle = handleFromPicker(picked);
      const appDir = path.join(resolveHandle(handle), APP_DIR);
      const liveDirs = [path.dirname(host.databasePath), host.attachmentsDir()];
      if (
        liveDirs.some(
          (d) => isSameOrInside(appDir, d) || isSameOrInside(d, appDir),
        )
      ) {
        throw new Error(
          "[BACKUP_DEST_CONFLICT] Choose a folder outside the Chronicles data and notes directories.",
        );
      }
      await checkWritable(resolveHandle(handle));
      await updateState(host.stateFile, (s) => ({
        ...s,
        destination: handle.serialized,
      }));
      return backups.status();
    },

    run(trigger) {
      return serialized(async () => {
        if (trigger === "activity") {
          const handle = await destination();
          if (!handle) return { status: "skipped", reason: "no-destination" };
          const appDir = path.join(resolveHandle(handle), APP_DIR);
          const newest = newestRegular(
            await readSnapshots(appDir).catch(() => []),
          );
          if (newest) {
            const age = now().getTime() - parseStamp(newest.id)!.getTime();
            if (age <= ACTIVITY_INTERVAL_MS) {
              return { status: "skipped", reason: "recent" };
            }
            if (liveFingerprint() === newest.manifest.fingerprint) {
              return { status: "skipped", reason: "unchanged" };
            }
          }
        }

        try {
          const created = await withLock((appDir) =>
            snapshot(appDir, trigger, new Set()),
          );
          await record(trigger, { snapshot: created.id });
          return { status: "created", snapshot: created };
        } catch (err) {
          await record(trigger, { error: errorMessage(err) });
          throw err;
        }
      });
    },

    async list() {
      const handle = await destination();
      if (!handle) return [];
      return summarize(
        await readSnapshots(path.join(resolveHandle(handle), APP_DIR)),
      );
    },

    restore(snapshotId) {
      return serialized(() =>
        withLock((appDir) => restoreLocked(appDir, snapshotId)),
      );
    },

    async scheduleRestore(snapshotId) {
      const appDir = await appDirOrThrow();
      const { dir, manifest } = await locate(appDir, snapshotId);
      await verifyLocated(path.join(dir, DATABASE_FILE), manifest);
      await updateState(host.stateFile, (s) => ({
        ...s,
        pendingRestore: snapshotId,
      }));
    },

    async applyPendingRestore() {
      const pending = (await readState(host.stateFile)).pendingRestore;
      if (!pending) return null;
      // Clear first so a restore that crashes the app cannot loop.
      await updateState(host.stateFile, ({ pendingRestore: _, ...s }) => s);

      const at = now().toISOString();
      try {
        const result = await backups.restore(pending);
        await updateState(host.stateFile, (s) => ({
          ...s,
          lastRestore: {
            at,
            snapshot: result.snapshot,
            preRestoreSnapshot: result.preRestoreSnapshot ?? undefined,
            attachments: result.attachments,
          },
        }));
        return result;
      } catch (err) {
        await updateState(host.stateFile, (s) => ({
          ...s,
          lastRestore: { at, snapshot: pending, error: errorMessage(err) },
        }));
        throw err;
      }
    },
  };

  return backups;
}
