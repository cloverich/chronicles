import crypto from "crypto";
import { eq } from "drizzle-orm";
import { type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import path from "path";
import yaml from "yaml";

import { createId } from "../preload/client/util";
import * as schema from "./schema";
import { documents, documentTags, imageLinks } from "./schema";

export interface ExportReport {
  destDir: string;
  notes: number;
  attachments: { copied: number; missing: string[] };
}

interface ManifestNote {
  id: string;
  journal: string;
  sha256: string;
}

interface Manifest {
  version: 1;
  exportedAt: string;
  notes: ManifestNote[];
  attachments: string[];
}

const ATTACHMENT_PREFIX = "../_attachments/";

/** Resolve a path, always ending without a trailing separator, for containment checks. */
function normalizeForContainment(p: string): string {
  const resolved = path.resolve(p);
  return resolved.endsWith(path.sep) ? resolved.slice(0, -1) : resolved;
}

/** True if `child` is the same path as `parent`, or nested inside it. */
function isSameOrInside(child: string, parent: string): boolean {
  const c = normalizeForContainment(child);
  const p = normalizeForContainment(parent);
  return c === p || c.startsWith(p + path.sep);
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.promises.lstat(p);
    return true;
  } catch (err: any) {
    if (err?.code === "ENOENT") return false;
    throw err;
  }
}

export class ExportClient {
  constructor(
    private db: BetterSQLite3Database<typeof schema>,
    private notesDir: string,
  ) {}

  export = async (destDir: string): Promise<ExportReport> => {
    const resolvedDest = path.resolve(destDir);
    const resolvedNotesDir = path.resolve(this.notesDir);

    if (await pathExists(resolvedDest)) {
      throw new Error(
        `[EXPORT_DEST_EXISTS] Export destination already exists: ${resolvedDest}`,
      );
    }

    if (
      isSameOrInside(resolvedDest, resolvedNotesDir) ||
      isSameOrInside(resolvedNotesDir, resolvedDest)
    ) {
      throw new Error(
        `[EXPORT_DEST_CONFLICT] Export destination must not be inside (or contain) the notes directory: ${resolvedDest}`,
      );
    }

    const tmpDir = path.join(
      path.dirname(resolvedDest),
      "." + path.basename(resolvedDest) + ".tmp-" + createId(),
    );

    try {
      await fs.promises.mkdir(tmpDir, { recursive: true });

      const report = await this.writeExport(tmpDir);

      await fs.promises.rename(tmpDir, resolvedDest);

      return { destDir: resolvedDest, ...report };
    } catch (err) {
      await fs.promises.rm(tmpDir, { recursive: true, force: true });
      throw err;
    }
  };

  private writeExport = async (
    tmpDir: string,
  ): Promise<Omit<ExportReport, "destDir">> => {
    const attachmentsDestDir = path.join(tmpDir, "_attachments");
    const notesAttachmentsDir = path.join(this.notesDir, "_attachments");

    const rows = await this.db
      .select()
      .from(documents)
      .orderBy(documents.journal, documents.id);

    const manifestNotes: ManifestNote[] = [];
    const copiedBasenames = new Set<string>();
    const missingBasenames = new Set<string>();
    let attachmentsCopied = 0;

    for (const row of rows) {
      const tagRows = await this.db
        .select({ tag: documentTags.tag })
        .from(documentTags)
        .where(eq(documentTags.documentId, row.id))
        .orderBy(documentTags.tag);
      const tags = tagRows.map((t) => t.tag);

      const userKeys: Record<string, any> = row.frontmatter
        ? JSON.parse(row.frontmatter)
        : {};
      const sortedUserKeyNames = Object.keys(userKeys).sort();

      const frontMatter: Record<string, any> = {};
      if (row.title != null) {
        frontMatter.title = row.title;
      }
      frontMatter.tags = tags;
      frontMatter.createdAt = row.createdAt;
      frontMatter.updatedAt = row.updatedAt;
      for (const key of sortedUserKeyNames) {
        frontMatter[key] = userKeys[key];
      }

      const yamlStr = yaml.stringify(frontMatter);
      const fileContents = `---\n${yamlStr}---\n\n${row.content}\n`;

      const journalDir = path.join(tmpDir, row.journal);
      await fs.promises.mkdir(journalDir, { recursive: true });
      const notePath = path.join(journalDir, `${row.id}.md`);
      await fs.promises.writeFile(notePath, fileContents, "utf8");

      const sha256 = crypto
        .createHash("sha256")
        .update(fileContents, "utf8")
        .digest("hex");
      manifestNotes.push({ id: row.id, journal: row.journal, sha256 });

      // ---- attachments referenced by this note ----
      const imageRows = await this.db
        .select({ imagePath: imageLinks.imagePath })
        .from(imageLinks)
        .where(eq(imageLinks.documentId, row.id));

      for (const { imagePath } of imageRows) {
        if (!imagePath.startsWith(ATTACHMENT_PREFIX)) continue;
        const basename = path.basename(imagePath);
        if (copiedBasenames.has(basename) || missingBasenames.has(basename)) {
          continue;
        }

        const sourcePath = path.join(notesAttachmentsDir, basename);
        if (!(await pathExists(sourcePath))) {
          missingBasenames.add(basename);
          continue;
        }

        await fs.promises.mkdir(attachmentsDestDir, { recursive: true });
        await fs.promises.copyFile(
          sourcePath,
          path.join(attachmentsDestDir, basename),
        );
        copiedBasenames.add(basename);
        attachmentsCopied++;
      }
    }

    const manifest: Manifest = {
      version: 1,
      exportedAt: new Date().toISOString(),
      notes: manifestNotes,
      attachments: Array.from(copiedBasenames).sort(),
    };

    await fs.promises.writeFile(
      path.join(tmpDir, "manifest.json"),
      JSON.stringify(manifest, null, 2) + "\n",
      "utf8",
    );

    return {
      notes: rows.length,
      attachments: {
        copied: attachmentsCopied,
        missing: Array.from(missingBasenames).sort(),
      },
    };
  };
}
