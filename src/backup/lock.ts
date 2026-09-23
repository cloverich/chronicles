import fs from "fs";
import path from "path";
import { LOCK_FILE } from "./manifest";

/** A lock older than this is assumed to belong to a crashed run. */
export const STALE_LOCK_MS = 60 * 60 * 1000;

/**
 * Takes `<appDir>/.lock` with O_EXCL. A concurrent run fails rather than
 * waits, so GC never races a snapshot that is writing blobs.
 */
export async function acquireLock(
  appDir: string,
): Promise<() => Promise<void>> {
  const lockPath = path.join(appDir, LOCK_FILE);
  const body = JSON.stringify({
    pid: process.pid,
    at: new Date().toISOString(),
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await fs.promises.writeFile(lockPath, body, { flag: "wx" });
      return async () => {
        await fs.promises.rm(lockPath, { force: true });
      };
    } catch (err: any) {
      if (err?.code !== "EEXIST") throw err;
      const stat = await fs.promises.stat(lockPath).catch(() => null);
      if (stat && Date.now() - stat.mtimeMs > STALE_LOCK_MS) {
        await fs.promises.rm(lockPath, { force: true });
        continue;
      }
      if (!stat) continue;
      throw new Error(
        "[BACKUP_BUSY] Another backup is running for this destination.",
      );
    }
  }
  throw new Error(
    "[BACKUP_BUSY] Another backup is running for this destination.",
  );
}
