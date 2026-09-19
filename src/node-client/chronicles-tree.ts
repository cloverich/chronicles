import fs from "fs";
import path from "path";

import type * as mdast from "mdast";
import { parseMarkdown } from "../markdown";
import { splitFrontMatter } from "../preload/client/importer/frontmatter";
import {
  SKIPPABLE_FILES,
  SKIPPABLE_PREFIXES,
  type FrontMatter,
} from "../preload/client/types";
import { checkId } from "../preload/client/util";
import { walk } from "../preload/utils/fs-utils";

/**
 * Pure filesystem discovery + parsing for a Chronicles notes tree
 * (`<root>/<journal>/<id>.md`). No DB access, no writes — this is the reader
 * the Chronicles importer (task 5) builds on, and is also usable as a
 * "repair" data source alongside `rebuildDerived()`.
 */

export interface TreeNote {
  id: string;
  journal: string;
  path: string;
  frontMatter: FrontMatter;
  mdast: mdast.Root;
}

export interface TreeReadReport {
  journals: string[];
  /** id → journals it appeared in, beyond the first (which wins) */
  duplicates: Map<string, string[]>;
  errored: { path: string; error: unknown }[];
}

/** Determines which filesystem entries to walk into / read */
const shouldIndex = (dirent: fs.Dirent) => {
  for (const prefix of SKIPPABLE_PREFIXES) {
    if (dirent.name.startsWith(prefix)) return false;
  }

  if (SKIPPABLE_FILES.has(dirent.name)) return false;

  if (dirent.isFile()) {
    return dirent.name.endsWith(".md");
  } else {
    return true;
  }
};

/**
 * Walks a Chronicles notes tree (`<root>/<journal>/<id>.md`), yielding a
 * parsed `TreeNote` for each valid file. Journal auto-create is the caller's
 * job (see task 5's importer) — use `report().journals` or the yielded
 * `journal` field to know what journals were discovered.
 *
 * The returned `report()` accumulates as iteration proceeds and is only
 * complete once the async iterable has been fully consumed.
 */
export function readChroniclesTree(rootDir: string): {
  notes: AsyncIterable<TreeNote>;
  report: () => TreeReadReport;
} {
  const journalsSeen = new Set<string>();
  const seenDocumentIds = new Map<string, string>(); // id -> first journal
  const duplicates = new Map<string, string[]>(); // id -> journals it also appeared in
  const errored: { path: string; error: unknown }[] = [];

  async function* generate(): AsyncIterable<TreeNote> {
    for await (const file of walk(rootDir, 1, shouldIndex)) {
      const { name, dir } = path.parse(file.path);
      const id = name;

      try {
        checkId(id);
      } catch {
        continue;
      }

      const journal = path.basename(dir);
      journalsSeen.add(journal);

      const previousJournal = seenDocumentIds.get(id);
      if (previousJournal) {
        const existing = duplicates.get(id);
        if (existing) {
          existing.push(journal);
        } else {
          duplicates.set(id, [journal]);
        }
        console.error(
          `[chronicles-tree] Duplicate document ID "${id}" found in journals: ${previousJournal}, ${journal}. Skipping duplicate.`,
        );
        continue;
      }
      seenDocumentIds.set(id, journal);

      try {
        const rawContents = await fs.promises.readFile(file.path, "utf8");
        const parsedMdast = parseMarkdown(rawContents);
        const { frontMatter, bodyMdast } = splitFrontMatter(
          parsedMdast,
          file.stats,
        );

        yield {
          id,
          journal,
          path: file.path,
          frontMatter,
          mdast: bodyMdast,
        };
      } catch (error) {
        errored.push({ path: file.path, error });
        console.error(
          "[chronicles-tree] Error parsing document",
          file.path,
          error,
        );
      }
    }
  }

  return {
    notes: generate(),
    report: () => ({
      journals: Array.from(journalsSeen),
      duplicates,
      errored,
    }),
  };
}
