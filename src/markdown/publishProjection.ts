import type * as mdast from "mdast";
import {
  canonicalBody,
  canonicalValue,
  compareCodePoints,
  formatKey,
} from "../contract/canonical";
import { parseAttachmentUrl } from "./attachmentRefs";
import { parseMarkdown } from "./index";
import { parseNoteLink } from "./noteLinks";
import { rewriteUrls } from "./rewriteUrls";

/**
 * Projection of one note into a publishable bundle. Spec: `spec/publish.md`.
 * Pure and runtime-free: the host reads the note and blobs, and writes the
 * result.
 */

export interface PublishTarget {
  kind: "hugo-bundle";
  /** Keys copied to the bundle's front matter; everything else is dropped. */
  frontMatter?: string[];
  author?: string;
  /** Public path the bundle directory is served under. */
  urlPrefix?: string;
  /** Write `chronicles: {id, revision}`. */
  provenance?: boolean;
}

export interface PublishableNote {
  id: string;
  title?: string | null;
  createdAt: string;
  tags: string[];
  frontMatter: Record<string, unknown>;
  content: string;
  revision: string;
}

export interface PublishBundle {
  /** `<date>/<slug>`, relative to the bundle root. */
  path: string;
  /** `<urlPrefix><date>/<slug>/`. */
  url: string;
  indexMd: string;
  /** Blobs to copy to `<path>/assets/<sha256><ext>`, in code-point order. */
  assets: { sha256: string; ext: string }[];
}

/** Front-matter keys the projection owns; never copied from user keys. */
const OWNED_KEYS = new Set([
  "title",
  "date",
  "author",
  "draft",
  "slug",
  "chronicles",
]);

/** Named now, projected by a later version of the spec. */
const RESERVED_KEYS = new Set(["headerImage", "footerImage"]);

const SLUG = /^[a-z0-9-]+$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;

export function publishError(code: string, message: string): Error {
  return new Error(`[${code}] ${message}`);
}

export function slugify(title: string): string {
  let slug = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[A-Z]/g, (c) => c.toLowerCase())
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length > 60) slug = slug.slice(0, 60).replace(/-+$/, "");
  return slug;
}

/** User `slug` when valid, else the slugified title. */
export function publishSlug(
  note: Pick<PublishableNote, "title" | "frontMatter">,
) {
  const own = note.frontMatter.slug;
  if (typeof own === "string" && SLUG.test(own)) return own;
  return slugify(note.title ?? "");
}

/** The publish date as written: user `date` when it is ISO 8601, else createdAt. */
export function publishDate(
  note: Pick<PublishableNote, "createdAt" | "frontMatter">,
): string {
  const own = note.frontMatter.date;
  if (
    typeof own === "string" &&
    ISO_DATE.test(own) &&
    !Number.isNaN(Date.parse(own))
  ) {
    return own;
  }
  return note.createdAt;
}

export function projectNote(
  note: PublishableNote,
  target: PublishTarget,
  /** note ID → public URL, for notes already published to this target. */
  published: Record<string, string> = {},
  /** Whether the host has a blob; a missing one fails the publish. */
  hasAttachment: (sha256: string, ext: string) => boolean = () => true,
): PublishBundle {
  if (target.kind !== "hugo-bundle") {
    throw publishError(
      "PUBLISH_UNKNOWN_TARGET",
      `Unknown target kind: ${target.kind}`,
    );
  }
  if (!note.title) {
    throw publishError(
      "PUBLISH_NO_TITLE",
      "Give the note a title to publish it",
    );
  }
  const slug = publishSlug(note);
  if (!slug) {
    throw publishError(
      "PUBLISH_NO_SLUG",
      "The title has no letters or digits for a URL; set a slug",
    );
  }
  const date = publishDate(note);
  const path = `${new Date(Date.parse(date)).toISOString().slice(0, 10)}/${slug}`;
  const url = `${target.urlPrefix ?? "/blog/"}${path}/`;

  const allow = new Set(target.frontMatter ?? []);
  const lines: string[] = [
    `title: ${JSON.stringify(note.title)}`,
    `date: ${JSON.stringify(date)}`,
  ];
  if (target.author) lines.push(`author: ${JSON.stringify(target.author)}`);
  const tags = Array.from(new Set(note.tags)).sort(compareCodePoints);
  if (allow.has("tags") && tags.length > 0) {
    lines.push(`tags: ${JSON.stringify(tags)}`);
  }
  const userKeys = Object.keys(note.frontMatter)
    .filter(
      (k) =>
        allow.has(k) &&
        k !== "tags" &&
        !OWNED_KEYS.has(k) &&
        !RESERVED_KEYS.has(k) &&
        note.frontMatter[k] !== undefined,
    )
    .sort(compareCodePoints);
  for (const key of userKeys) {
    const value = JSON.stringify(canonicalValue(note.frontMatter[key]));
    lines.push(`${formatKey(key)}: ${value}`);
  }
  lines.push("draft: false");
  if (target.provenance ?? true) {
    lines.push(
      `chronicles: ${JSON.stringify({ id: note.id, revision: note.revision })}`,
    );
  }

  const { markdown, assets } = projectBody(
    note.content,
    published,
    hasAttachment,
  );
  const body = canonicalBody(markdown);
  const indexMd = `---\n${lines.join("\n")}\n---\n` + (body ? `\n${body}` : "");
  return { path, url, indexMd, assets };
}

function storedNoteId(url: string): string | null {
  const link = parseNoteLink(url);
  return link && link.journalName === null ? link.noteId : null;
}

function projectBody(
  content: string,
  published: Record<string, string>,
  hasAttachment: (sha256: string, ext: string) => boolean,
): { markdown: string; assets: { sha256: string; ext: string }[] } {
  // Pass 1: links to unpublished notes become their text.
  const source = content;
  const edits: { start: number; end: number; text: string }[] = [];
  const visit = (node: mdast.Node) => {
    if (node.type === "link") {
      const link = node as mdast.Link;
      const id = storedNoteId(link.url);
      const start = link.position?.start.offset;
      const end = link.position?.end.offset;
      if (id && !(id in published) && start != null && end != null) {
        const first = link.children[0]?.position?.start.offset;
        const last =
          link.children[link.children.length - 1]?.position?.end.offset;
        const text =
          first != null && last != null ? source.slice(first, last) : "";
        edits.push({ start, end, text });
        return;
      }
    }
    if ("children" in node) {
      for (const child of (node as mdast.Parent).children) visit(child);
    }
  };
  visit(parseMarkdown(source));
  edits.sort((a, b) => b.start - a.start);
  let markdown = source;
  for (const e of edits) {
    markdown = markdown.slice(0, e.start) + e.text + markdown.slice(e.end);
  }

  // Pass 2: destinations of attachments and published notes.
  const assets = new Map<string, { sha256: string; ext: string }>();
  const missing: string[] = [];
  const rewritten = rewriteUrls(markdown, (url, node) => {
    const attachment = parseAttachmentUrl(url);
    if (attachment) {
      const name = `${attachment.sha256}${attachment.ext}`;
      if (!hasAttachment(attachment.sha256, attachment.ext)) {
        missing.push(name);
        return undefined;
      }
      assets.set(name, attachment);
      return `assets/${name}`;
    }
    const id = storedNoteId(url);
    if (!id) return undefined;
    if (id in published) return published[id];
    if (node.type === "definition") {
      throw publishError(
        "PUBLISH_PRIVATE_LINK",
        `A link definition points to a note that is not published: ${id}`,
      );
    }
    return undefined;
  }).markdown;

  if (missing.length > 0) {
    throw publishError(
      "PUBLISH_MISSING_ATTACHMENT",
      `Missing attachments: ${missing.join(", ")}`,
    );
  }
  return {
    markdown: rewritten,
    assets: Array.from(assets.keys())
      .sort(compareCodePoints)
      .map((k) => assets.get(k)!),
  };
}
