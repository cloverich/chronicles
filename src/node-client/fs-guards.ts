import fs from "fs";
import path from "path";

/** Resolve a path, always ending without a trailing separator, for containment checks. */
export function normalizeForContainment(p: string): string {
  const resolved = path.resolve(p);
  return resolved.endsWith(path.sep) ? resolved.slice(0, -1) : resolved;
}

/** True if `child` is the same path as `parent`, or nested inside it. */
export function isSameOrInside(child: string, parent: string): boolean {
  const c = normalizeForContainment(child);
  const p = normalizeForContainment(parent);
  return c === p || c.startsWith(p + path.sep);
}

export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.promises.lstat(p);
    return true;
  } catch (err: any) {
    if (err?.code === "ENOENT") return false;
    throw err;
  }
}
