import crypto from "crypto";
import yaml from "yaml";

import { serializeNote, type CanonicalNote } from "../contract/canonical";

export {
  CANONICAL_KEY_ORDER,
  canonicalBody,
  compareCodePoints,
  serializeNote,
  type CanonicalNote,
} from "../contract/canonical";

/** sha256 hex of the canonical bytes. */
export function noteRevision(serialized: string): string {
  return crypto.createHash("sha256").update(serialized, "utf8").digest("hex");
}

/**
 * A note's revision: the hash of its canonical serialization with references
 * in stored form (`chronicles://note/…`, `chronicles://attachment/…`). It
 * depends on the note alone — unlike exported bytes, whose link paths depend
 * on other notes' journals.
 */
export function computeRevision(note: CanonicalNote): string {
  return noteRevision(serializeNote(note));
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
