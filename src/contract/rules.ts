/**
 * Product rules every NotesClient implementation shares. Pure functions;
 * spec: `spec/notes-client.md`.
 */

export const MAX_JOURNAL_NAME_LENGTH = 25;

/**
 * Trim and validate a journal name; throws an Error describing the problem.
 * Names are unique ignoring ASCII case (checked by the caller).
 */
export function validateJournalName(name: string): string {
  name = name?.trim() || "";
  if (!name) throw new Error("Journal name cannot be empty.");
  if (name === "_attachments") {
    throw new Error("Journal name cannot be '_attachments'.");
  }
  if (name.length > MAX_JOURNAL_NAME_LENGTH) {
    throw new Error(
      `Journal name exceeds max length of ${MAX_JOURNAL_NAME_LENGTH} characters.`,
    );
  }
  if (
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(
      name,
    )
  ) {
    throw new Error("Journal name is not URL safe.");
  }
  if (name.includes("/")) {
    throw new Error("Journal name contains invalid path characters.");
  }
  return name;
}

/** ASCII-only case folding, matching SQLite's lower(). */
export function asciiLower(s: string): string {
  return s.replace(/[A-Z]/g, (c) => c.toLowerCase());
}

/** `before` is a date (`YYYY`, `YYYY-MM`, `YYYY-MM-DD`) or else a note id. */
export function isDateToken(s: string): boolean {
  return /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(s);
}
