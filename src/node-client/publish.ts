import { eq } from "drizzle-orm";
import { type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import path from "path";

import { attachmentPoolPath } from "../markdown/attachmentRefs";
import {
  projectNote,
  publishError,
  type PublishableNote,
  type PublishBundle,
  type PublishTarget,
} from "../markdown/publishProjection";
import { createId } from "../preload/client/util";
import { parseNoteFile } from "./canonical-note";
import * as schema from "./schema";
import { documents, documentTags } from "./schema";

/**
 * Publishing a note into a bundle root (for the blog, its `content/blog/`).
 * Spec: `spec/publish.md` ("Publishing a note", "Publication state"). The
 * root is the publication record: each bundle carries `chronicles.id` and
 * `chronicles.revision`.
 */

export type PublishState = "draft" | "published" | "edited";

export interface PublishStatus {
  state: PublishState;
  /** Bundle path relative to the root, when published. */
  path?: string;
  url?: string;
}

interface Bundle {
  path: string;
  url: string;
  revision: string;
}

export class PublishClient {
  constructor(
    private db: BetterSQLite3Database<typeof schema>,
    private notesDir: string,
  ) {}

  /** Bundles in the root, by note ID. */
  scan = async (
    root: string,
    target: PublishTarget,
  ): Promise<Map<string, Bundle>> => {
    const found = new Map<string, Bundle>();
    const prefix = target.urlPrefix ?? "/blog/";
    for (const date of await readDirs(root)) {
      for (const slug of await readDirs(path.join(root, date))) {
        const rel = `${date}/${slug}`;
        const provenance = await readProvenance(path.join(root, rel));
        if (provenance) {
          found.set(provenance.id, {
            path: rel,
            url: `${prefix}${rel}/`,
            revision: provenance.revision,
          });
        }
      }
    }
    return found;
  };

  status = async (
    id: string,
    root: string,
    target: PublishTarget,
  ): Promise<PublishStatus> => {
    const bundle = (await this.scan(root, target)).get(id);
    if (!bundle) return { state: "draft" };
    const note = this.load(id);
    return {
      state: bundle.revision === note.revision ? "published" : "edited",
      path: bundle.path,
      url: bundle.url,
    };
  };

  /**
   * Project the note and write its bundle. The caller pins `slug` and `date`
   * into the note first (spec step 1), so the path stays put.
   */
  publish = async (
    id: string,
    root: string,
    target: PublishTarget,
  ): Promise<PublishStatus> => {
    const rootStat = await fs.promises.stat(root).catch(() => null);
    if (!rootStat?.isDirectory()) {
      throw publishError(
        "PUBLISH_NO_ROOT",
        `The blog folder does not exist: ${root}`,
      );
    }

    const bundles = await this.scan(root, target);
    const published = Object.fromEntries(
      Array.from(bundles, ([noteId, b]) => [noteId, b.url]),
    );
    const bundle = this.project(id, target, published);

    const dest = path.join(root, bundle.path);
    const existing = await readProvenance(dest);
    if (fs.existsSync(dest) && existing?.id !== id) {
      throw publishError(
        "PUBLISH_PATH_TAKEN",
        `${bundle.path} already holds another post; set a different slug`,
      );
    }

    // Build beside the destination, then swap it in.
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    const tmp = `${dest}.tmp-${createId()}`;
    try {
      await fs.promises.mkdir(path.join(tmp, "assets"), { recursive: true });
      await fs.promises.writeFile(
        path.join(tmp, "index.md"),
        bundle.indexMd,
        "utf8",
      );
      for (const { sha256, ext } of bundle.assets) {
        await fs.promises.copyFile(
          this.blobPath(sha256, ext),
          path.join(tmp, "assets", `${sha256}${ext}`),
        );
      }
      if (bundle.assets.length === 0) {
        await fs.promises.rmdir(path.join(tmp, "assets"));
      }
      // Keep resized images the site's script already wrote for this post.
      await carryOverResized(dest, tmp);
      await fs.promises.rm(dest, { recursive: true, force: true });
      await fs.promises.rename(tmp, dest);
    } catch (err) {
      await fs.promises.rm(tmp, { recursive: true, force: true });
      throw err;
    }

    // The slug or date changed: remove the post's old bundle.
    const old = bundles.get(id);
    if (old && old.path !== bundle.path) {
      await fs.promises.rm(path.join(root, old.path), {
        recursive: true,
        force: true,
      });
      const oldDateDir = path.join(root, path.dirname(old.path));
      if ((await readDirs(oldDateDir)).length === 0) {
        await fs.promises.rm(oldDateDir, { recursive: true, force: true });
      }
    }

    return { state: "published", path: bundle.path, url: bundle.url };
  };

  /** The pure projection of a stored note (spec vectors run this). */
  project = (
    id: string,
    target: PublishTarget,
    published: Record<string, string>,
  ): PublishBundle =>
    projectNote(this.load(id), target, published, (sha, ext) =>
      fs.existsSync(this.blobPath(sha, ext)),
    );

  blobPath = (sha256: string, ext: string) =>
    path.join(this.notesDir, "_attachments", attachmentPoolPath(sha256, ext));

  private load = (id: string): PublishableNote => {
    const [row] = this.db
      .select()
      .from(documents)
      .where(eq(documents.id, id))
      .all();
    if (!row) {
      throw new Error(`[DOCUMENT_NOT_FOUND] Document ${id} not found`);
    }
    const tags = this.db
      .select({ tag: documentTags.tag })
      .from(documentTags)
      .where(eq(documentTags.documentId, id))
      .all()
      .map((t) => t.tag);
    return {
      id: row.id,
      title: row.title,
      createdAt: row.createdAt,
      tags,
      frontMatter: row.frontmatter ? JSON.parse(row.frontmatter) : {},
      content: row.content,
      revision: row.revision,
    };
  };
}

async function readDirs(dir: string): Promise<string[]> {
  const entries = await fs.promises
    .readdir(dir, { withFileTypes: true })
    .catch(() => []);
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
    .filter((name) => !name.includes(".tmp-"));
}

async function readProvenance(
  bundleDir: string,
): Promise<{ id: string; revision: string } | null> {
  const raw = await fs.promises
    .readFile(path.join(bundleDir, "index.md"), "utf8")
    .catch(() => null);
  if (raw == null) return null;
  try {
    const c = parseNoteFile(raw).frontMatter.chronicles;
    return c && typeof c.id === "string"
      ? { id: c.id, revision: String(c.revision ?? "") }
      : null;
  } catch {
    return null;
  }
}

/**
 * The blog's image script resizes `assets/*` in place, so a republish would
 * otherwise put the full-size blob back. An asset whose name the new bundle
 * also writes is kept from the old bundle: names are content hashes of the
 * original, so the same name means the same image.
 */
async function carryOverResized(oldDir: string, newDir: string) {
  const oldAssets = path.join(oldDir, "assets");
  const names = await fs.promises.readdir(oldAssets).catch(() => []);
  for (const name of names) {
    const next = path.join(newDir, "assets", name);
    if (fs.existsSync(next)) {
      await fs.promises.copyFile(path.join(oldAssets, name), next);
    }
  }
}
