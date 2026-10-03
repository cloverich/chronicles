import crypto from "crypto";
import yaml from "yaml";

/**
 * Canonical note serialization — the exact bytes the export writes for a
 * note, and therefore the input to its revision hash. Spec:
 * `spec/export-format.md` ("Note file"). Any change here is a format change;
 * update the spec and `spec/vectors/export` together.
 */

export interface CanonicalNote {
  id: string;
  title?: string | null;
  journal: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  /** Arbitrary user frontmatter keys (no column-owned keys). */
  frontMatter: Record<string, unknown>;
  /** Markdown body without frontmatter. */
  content: string;
}

/** Keys owned by columns; emitted first, in this order. */
export const CANONICAL_KEY_ORDER = [
  "id",
  "title",
  "journal",
  "createdAt",
  "updatedAt",
  "tags",
] as const;

const PLAIN_KEY = /^[A-Za-z][A-Za-z0-9_-]*$/;
const YAML_RESERVED_KEYS = new Set([
  "null",
  "true",
  "false",
  "yes",
  "no",
  "on",
  "off",
  "y",
  "n",
]);

/** Compare strings by Unicode code point (equivalently, UTF-8 byte order). */
export function compareCodePoints(a: string, b: string): number {
  const ai = a[Symbol.iterator]();
  const bi = b[Symbol.iterator]();
  for (;;) {
    const x = ai.next();
    const y = bi.next();
    if (x.done || y.done) return x.done ? (y.done ? 0 : -1) : 1;
    const d = x.value.codePointAt(0)! - y.value.codePointAt(0)!;
    if (d !== 0) return d;
  }
}

/** Recursively sort object keys by code point, dropping undefined values. */
function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort(compareCodePoints)) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) out[key] = canonicalValue(v);
    }
    return out;
  }
  return value;
}

function formatKey(key: string): string {
  return PLAIN_KEY.test(key) && !YAML_RESERVED_KEYS.has(key.toLowerCase())
    ? key
    : JSON.stringify(key);
}

/** Normalize line endings and trailing newlines of a note body. */
export function canonicalBody(content: string): string {
  const lf = content.replace(/\r\n/g, "\n").replace(/\n+$/, "");
  return lf === "" ? "" : lf + "\n";
}

export function serializeNote(note: CanonicalNote): string {
  const lines: string[] = [`id: ${JSON.stringify(note.id)}`];
  if (note.title != null) lines.push(`title: ${JSON.stringify(note.title)}`);
  lines.push(`journal: ${JSON.stringify(note.journal)}`);
  lines.push(`createdAt: ${JSON.stringify(note.createdAt)}`);
  lines.push(`updatedAt: ${JSON.stringify(note.updatedAt)}`);
  const tags = Array.from(new Set(note.tags)).sort(compareCodePoints);
  lines.push(`tags: ${JSON.stringify(tags)}`);

  const userKeys = Object.keys(note.frontMatter)
    .filter((k) => note.frontMatter[k] !== undefined)
    .sort(compareCodePoints);
  for (const key of userKeys) {
    if ((CANONICAL_KEY_ORDER as readonly string[]).includes(key)) continue;
    const value = JSON.stringify(canonicalValue(note.frontMatter[key]));
    lines.push(`${formatKey(key)}: ${value}`);
  }

  const body = canonicalBody(note.content);
  return `---\n${lines.join("\n")}\n---\n` + (body ? `\n${body}` : "");
}

/** sha256 hex of the canonical bytes. */
export function noteRevision(serialized: string): string {
  return crypto.createHash("sha256").update(serialized, "utf8").digest("hex");
}

/**
 * Split a note file into its raw frontmatter object and body, preserving the
 * body bytes. Accepts canonical (v2) and legacy (v1, block-style YAML) files.
 * A file without a leading `---` fence has no frontmatter.
 */
export function parseNoteFile(raw: string): {
  frontMatter: Record<string, any>;
  body: string;
} {
  const text = raw.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) return { frontMatter: {}, body: text };

  const close = text.indexOf("\n---", 3);
  // Closing fence must be its own line: "\n---\n" or "\n---" at EOF.
  if (close === -1 || !/^\n---(\n|$)/.test(text.slice(close, close + 5))) {
    return { frontMatter: {}, body: text };
  }

  const yamlText = text.slice(4, close + 1);
  const frontMatter = (yaml.parse(yamlText) as Record<string, any>) || {};
  let body = text.slice(close + 4);
  if (body.startsWith("\n")) body = body.slice(1);
  if (body.startsWith("\n")) body = body.slice(1);
  return { frontMatter, body };
}
