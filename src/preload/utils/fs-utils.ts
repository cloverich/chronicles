import fs, { Stats } from "fs";
import path from "path";

export interface PathStatsFile {
  path: string;
  stats: Stats;
}

type ShouldIndex = (file: fs.Dirent) => boolean;

/**
 * Walk directory, for index and sync routines
 * @param dir - Where to start walking
 * @param depthLimit - A limit on how deep to walk
 * @param shouldIndex - A function that determines whether to index a file / directory
 *
 * usage:
 * ```
 * for await (const file of walk(rootDir, 1, shouldIndex)) { ... }
 * ```
 */
export async function* walk(
  dir: string,
  depthLimit = Infinity,
  shouldIndex: ShouldIndex,
  currentDepth = 0,
): AsyncGenerator<PathStatsFile> {
  if (currentDepth > depthLimit) return;

  // Ensure dir is absolute path
  dir = path.resolve(dir);

  const dirHandle = await fs.promises.opendir(dir);
  for await (const entry of dirHandle) {
    const fullPath = path.join(dir, entry.name);
    // Skip hidden files/directories or other excluded names
    if (entry.isSymbolicLink()) continue; // Skip symlinks entirely
    if (!shouldIndex(entry)) continue;

    if (entry.isDirectory()) {
      // we don't yield directories, just contents
      yield* walk(fullPath, depthLimit, shouldIndex, currentDepth + 1);
    } else {
      const stats = await fs.promises.lstat(fullPath); // Use lstat to check for symlinks
      yield { path: fullPath, stats }; // Yield file path and stats
    }
  }
}

/**
 * Create directory recursively, similar to mkdir -p
 * @param dir - Directory path to create
 */
export async function mkdirp(dir: string) {
  try {
    await fs.promises.mkdir(dir, { recursive: true });
  } catch (err) {
    if ((err as any).code === "EEXIST") {
      // confirm it's a directory
      const stats = await fs.promises.stat(dir);
      if (!stats.isDirectory()) {
        throw new Error(`[mkdirp] ${dir} already exists as a file`);
      }

      // already exists, good to go
      return dir;
    } else {
      throw err;
    }
  }
}
