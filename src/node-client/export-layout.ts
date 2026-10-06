import { compareCodePoints } from "./canonical-note";

/**
 * Export layout rules shared by export and import. Spec:
 * `spec/export-format.md` ("Journal directories", "Links").
 */

export const EXPORT_FORMAT_VERSION = "2.0";
export const EXPORT_FORMAT_MAJOR = 2;

const UNSAFE_CHARS = /[<>:"/\\|?*\u0000-\u001f\u007f]/g;
const SKIPPED_PREFIXES = [".", "_", "*", "~"];
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/**
 * Map journal names to unique, filesystem-safe directory names. Journals are
 * assigned in code-point order of name; a collision (ignoring ASCII case)
 * gets `-2`, `-3`, ... appended.
 */
export function assignJournalDirs(names: string[]): Map<string, string> {
  const result = new Map<string, string>();
  const taken = new Set<string>(["_attachments"]);

  for (const name of [...names].sort(compareCodePoints)) {
    let base = name.replace(UNSAFE_CHARS, "_").replace(/[. ]+$/, "");
    if (!base) base = "journal";
    if (SKIPPED_PREFIXES.some((p) => base.startsWith(p))) base = "j" + base;
    if (WINDOWS_RESERVED.test(base)) base = base + "_";

    let dir = base;
    for (let n = 2; taken.has(dir.toLowerCase()); n++) dir = `${base}-${n}`;
    taken.add(dir.toLowerCase());
    result.set(name, dir);
  }
  return result;
}

/**
 * Percent-encode a path segment for use as a CommonMark link destination:
 * only characters that would break or change the destination are encoded;
 * other non-ASCII characters are left as-is.
 */
export function encodeLinkSegment(segment: string): string {
  return segment.replace(
    /[\u0000- %()<>#?\\\u007f]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0"),
  );
}

export function decodeLinkSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
