import fs from "fs";
import os from "os";
import path from "path";
import { isSameOrInside } from "./fs-guards";

/**
 * Known consumer sync-service roots on macOS. The live database and notes
 * directory must not live inside one: sync services lock, evict, and
 * conflict-copy files that are modified after they are written. Snapshots,
 * which are write-once, are fine there.
 */
function syncRoots(home: string): { root: string; label: string }[] {
  return [
    {
      root: path.join(home, "Library", "Mobile Documents"),
      label: "iCloud Drive",
    },
    { root: path.join(home, "Library", "CloudStorage"), label: "" },
  ];
}

function realpathOrSelf(p: string): string {
  // Resolve the deepest existing ancestor, so a not-yet-created folder under
  // a symlink (e.g. ~/Dropbox -> ~/Library/CloudStorage/Dropbox) still counts.
  let current = path.resolve(p);
  const rest: string[] = [];
  for (;;) {
    try {
      return path.join(fs.realpathSync(current), ...rest);
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return path.resolve(p);
      rest.unshift(path.basename(current));
      current = parent;
    }
  }
}

/**
 * Returns a label for the sync service whose folder contains `dir`, or null.
 */
export function syncFolderContaining(
  dir: string,
  home: string = os.homedir(),
): string | null {
  const candidates = [path.resolve(dir), realpathOrSelf(dir)];
  for (const { root, label } of syncRoots(home)) {
    const roots = [root, realpathOrSelf(root)];
    for (const c of candidates) {
      const r = roots.find((r) => isSameOrInside(c, r));
      if (!r) continue;
      if (label) return label;
      // ~/Library/CloudStorage/<Provider-account>/…
      const provider = path.relative(r, c).split(path.sep)[0];
      return provider ? provider.split("-")[0] : "a cloud storage provider";
    }
  }
  return null;
}
