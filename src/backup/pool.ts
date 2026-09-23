import crypto from "crypto";
import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import type { ManifestAttachment } from "./manifest";

/**
 * Content-addressed attachment pool: `<pool>/<sha256[0:2]>/<sha256>`.
 * A blob is written only when missing, via a temp file and rename, so two
 * writers of the same name always produce identical bytes.
 */

export function blobPath(poolDir: string, sha256: string): string {
  return path.join(poolDir, sha256.slice(0, 2), sha256);
}

export function tempName(prefix: string): string {
  return `.tmp-${prefix}-${process.pid}-${crypto.randomBytes(6).toString("hex")}`;
}

export async function hashFile(
  file: string,
): Promise<{ sha256: string; bytes: number }> {
  const hash = crypto.createHash("sha256");
  let bytes = 0;
  await pipeline(fs.createReadStream(file), async function* (source) {
    for await (const chunk of source) {
      hash.update(chunk);
      bytes += chunk.length;
    }
  });
  return { sha256: hash.digest("hex"), bytes };
}

/** Copies `src` to `dest` via a temp file in dest's directory, then renames. */
export async function copyAtomic(src: string, dest: string): Promise<void> {
  const dir = path.dirname(dest);
  await fs.promises.mkdir(dir, { recursive: true });
  const tmp = path.join(dir, tempName("copy"));
  try {
    await fs.promises.copyFile(src, tmp);
    await fs.promises.rename(tmp, dest);
  } catch (err) {
    await fs.promises.rm(tmp, { force: true });
    throw err;
  }
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.promises.lstat(p);
    return true;
  } catch (err: any) {
    if (err?.code === "ENOENT") return false;
    throw err;
  }
}

/**
 * Lists attachment files under `dir` as '/'-separated relative names. Skips
 * dotfiles (.DS_Store, editor temp files) and symlinks.
 */
export async function listAttachments(dir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(abs: string, rel: string) {
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(abs, { withFileTypes: true });
    } catch (err: any) {
      if (err?.code === "ENOENT" && rel === "") return;
      throw err;
    }
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(path.join(abs, e.name), childRel);
      else if (e.isFile()) out.push(childRel);
    }
  }
  await walk(dir, "");
  return out.sort();
}

type HashCache = Map<string, { sha256: string; bytes: number }>;

/**
 * Hashes every attachment and writes missing blobs into the pool. Hashes are
 * cached by (name, size, mtime) for the life of the process.
 */
export async function ingestAttachments(
  attachmentsDir: string,
  poolDir: string,
  cache: HashCache,
): Promise<ManifestAttachment[]> {
  const names = await listAttachments(attachmentsDir);
  const result: ManifestAttachment[] = [];

  for (const name of names) {
    const src = path.join(attachmentsDir, ...name.split("/"));
    const stat = await fs.promises.stat(src);
    const key = `${name}\0${stat.size}\0${stat.mtimeMs}`;
    let entry = cache.get(key) ?? (await hashFile(src));

    const target = blobPath(poolDir, entry.sha256);
    if (!(await exists(target))) {
      // Copy, then name the blob by what was actually copied: if the source
      // changed after hashing, the copy's hash is the truth.
      const dir = path.dirname(target);
      await fs.promises.mkdir(dir, { recursive: true });
      const tmp = path.join(dir, tempName("blob"));
      try {
        await fs.promises.copyFile(src, tmp);
        entry = await hashFile(tmp);
        const finalPath = blobPath(poolDir, entry.sha256);
        await fs.promises.mkdir(path.dirname(finalPath), { recursive: true });
        await fs.promises.rename(tmp, finalPath);
      } catch (err) {
        await fs.promises.rm(tmp, { force: true });
        throw err;
      }
    }

    cache.set(key, entry);
    result.push({ name, sha256: entry.sha256, bytes: entry.bytes });
  }

  return result;
}

/**
 * Deletes blobs no surviving manifest references, plus stray temp files.
 * Only touches `<pool>/<2 hex>/<file>` entries; anything else is left alone.
 */
export async function collectGarbage(
  poolDir: string,
  referenced: Set<string>,
): Promise<{ deleted: number }> {
  let deleted = 0;
  let prefixes: fs.Dirent[];
  try {
    prefixes = await fs.promises.readdir(poolDir, { withFileTypes: true });
  } catch (err: any) {
    if (err?.code === "ENOENT") return { deleted };
    throw err;
  }

  for (const prefix of prefixes) {
    if (!prefix.isDirectory() || !/^[0-9a-f]{2}$/.test(prefix.name)) continue;
    const dir = path.join(poolDir, prefix.name);
    const files = await fs.promises.readdir(dir, { withFileTypes: true });
    let remaining = files.length;
    for (const f of files) {
      if (!f.isFile()) continue;
      const isBlob = /^[0-9a-f]{64}$/.test(f.name);
      const isTemp = f.name.startsWith(".tmp-");
      if ((isBlob && !referenced.has(f.name)) || isTemp) {
        await fs.promises.rm(path.join(dir, f.name), { force: true });
        remaining--;
        if (isBlob) deleted++;
      }
    }
    if (remaining === 0) {
      await fs.promises.rmdir(dir).catch(() => {});
    }
  }

  return { deleted };
}

/**
 * Writes the manifest's attachments into `attachmentsDir`: missing files are
 * written from the pool, existing files are left alone, and blobs missing from
 * the pool are reported.
 */
export async function materializeAttachments(
  attachments: ManifestAttachment[],
  poolDir: string,
  attachmentsDir: string,
): Promise<{ written: number; existing: number; missing: string[] }> {
  const result = { written: 0, existing: 0, missing: [] as string[] };
  const root = path.resolve(attachmentsDir);

  for (const a of attachments) {
    const target = path.resolve(root, ...a.name.split("/"));
    if (!target.startsWith(root + path.sep)) {
      result.missing.push(a.name);
      continue;
    }
    if (await exists(target)) {
      result.existing++;
      continue;
    }
    const blob = blobPath(poolDir, a.sha256);
    if (!(await exists(blob))) {
      result.missing.push(a.name);
      continue;
    }
    await copyAtomic(blob, target);
    result.written++;
  }

  return result;
}
