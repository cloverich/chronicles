import type { BackupTrigger } from "./types";

/**
 * manifest.json, format 1. The shared schema lives beside this file
 * (backup-manifest.schema.json, vendored from code/docs); the conformance
 * test asserts emitted manifests validate against it.
 */
export interface Manifest {
  format: 1;
  app: string;
  appVersion: string;
  createdAt: string;
  trigger: BackupTrigger;
  fingerprint: string;
  database: {
    file: typeof DATABASE_FILE;
    bytes: number;
    sha256: string;
    integrity: "ok";
    counts: Record<string, number>;
  };
  attachments: ManifestAttachment[];
}

export interface ManifestAttachment {
  /** Relative to the attachments directory, '/'-separated. */
  name: string;
  sha256: string;
  bytes: number;
}

export const APP_DIR = "chronicles";
export const SNAPSHOTS_DIR = "snapshots";
export const POOL_DIR = "attachments";
export const LOCK_FILE = ".lock";
export const MANIFEST_FILE = "manifest.json";
export const DATABASE_FILE = "db.sqlite3";

const TRIGGERS: readonly BackupTrigger[] = [
  "activity",
  "manual",
  "install",
  "pre-restore",
];
const SHA256 = /^[0-9a-f]{64}$/;
const CREATED_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const STAMP = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})Z$/;

/** 2026-09-22T14:25:34Z — UTC, second precision. */
export function createdAtFor(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** The snapshot directory name: createdAt with ':' replaced by '-'. */
export function stampFor(createdAt: string): string {
  return createdAt.replace(/:/g, "-");
}

/** Parses a snapshot directory name; null for anything we did not write. */
export function parseStamp(name: string): Date | null {
  const m = STAMP.exec(name);
  if (!m) return null;
  const d = new Date(`${m[1]}T${m[2]}:${m[3]}:${m[4]}Z`);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * A safe attachment name: relative, '/'-separated, no empty, '.', or '..'
 * segments, and no backslashes. Readers must reject anything else, since the
 * name becomes a write target on restore.
 */
export function isSafeAttachmentName(name: string): boolean {
  if (typeof name !== "string" || name.length === 0) return false;
  if (name.includes("\\") || name.includes("\0")) return false;
  return name
    .split("/")
    .every((seg) => seg.length > 0 && seg !== "." && seg !== "..");
}

function isCount(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

/**
 * Parses and validates a manifest for the given snapshot directory name.
 * Returns null when it is not a valid Chronicles format-1 manifest; such a
 * snapshot is ignored by listing and deleted by pruning.
 */
export function parseManifest(raw: string, stamp: string): Manifest | null {
  let m: any;
  try {
    m = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!m || typeof m !== "object") return null;
  if (m.format !== 1 || m.app !== APP_DIR) return null;
  if (typeof m.appVersion !== "string" || m.appVersion.length === 0)
    return null;
  if (typeof m.createdAt !== "string" || !CREATED_AT.test(m.createdAt))
    return null;
  if (stampFor(m.createdAt) !== stamp) return null;
  if (!TRIGGERS.includes(m.trigger)) return null;
  if (typeof m.fingerprint !== "string") return null;

  const db = m.database;
  if (!db || typeof db !== "object") return null;
  if (db.file !== DATABASE_FILE || db.integrity !== "ok") return null;
  if (!isCount(db.bytes) || db.bytes < 1) return null;
  if (typeof db.sha256 !== "string" || !SHA256.test(db.sha256)) return null;
  if (!db.counts || typeof db.counts !== "object") return null;
  if (!Object.values(db.counts).every(isCount)) return null;

  if (!Array.isArray(m.attachments)) return null;
  for (const a of m.attachments) {
    if (!a || typeof a !== "object") return null;
    if (!isSafeAttachmentName(a.name)) return null;
    if (typeof a.sha256 !== "string" || !SHA256.test(a.sha256)) return null;
    if (!isCount(a.bytes)) return null;
  }

  return m as Manifest;
}
