import fs from "fs";
import path from "path";
import { tempName } from "./pool";

/**
 * The persisted backup destination, as an opaque handle. Today it serializes
 * a picked path; a sandboxed build would store a security-scoped bookmark and
 * resolve it here. Only the native picker produces a handle.
 */
export interface DestinationHandle {
  readonly serialized: string;
}

const PATH_PREFIX = "path:";

export function handleFromPicker(picked: string): DestinationHandle {
  return { serialized: PATH_PREFIX + path.resolve(picked) };
}

export function parseHandle(serialized: unknown): DestinationHandle | null {
  if (typeof serialized !== "string") return null;
  if (!serialized.startsWith(PATH_PREFIX)) return null;
  const p = serialized.slice(PATH_PREFIX.length);
  return path.isAbsolute(p) ? { serialized } : null;
}

/** Resolves a handle to the folder the user picked. */
export function resolveHandle(handle: DestinationHandle): string {
  return handle.serialized.slice(PATH_PREFIX.length);
}

/** Verifies the folder exists and is readable and writable. */
export async function checkWritable(dir: string): Promise<void> {
  const stat = await fs.promises.stat(dir).catch(() => null);
  if (!stat?.isDirectory()) {
    throw new Error(`[BACKUP_DEST_MISSING] Backup folder is unavailable.`);
  }
  await fs.promises.readdir(dir);
  const probe = path.join(dir, tempName("probe"));
  await fs.promises.writeFile(probe, "", { flag: "wx" });
  await fs.promises.rm(probe, { force: true });
}
