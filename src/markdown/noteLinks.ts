/**
 * Note link grammar; spec: `spec/data-model.md` ("Note links").
 *
 * - Stored form: `chronicles://note/<id>` — ID only, so moving a note or
 *   renaming a journal never touches link text.
 * - Path form: `../<journal>/<id>.md` — exported files, legacy stored
 *   content, and imports. The journal segment is informational only.
 */

export const NOTE_LINK_PREFIX = "chronicles://note/";

const storedRegex = /^chronicles:\/\/note\/([a-zA-Z0-9-]+)$/;
const pathRegex = /^\.\.\/(?:(.+)\/)?([a-zA-Z0-9-]+)\.md$/;

export function noteLinkUrl(noteId: string): string {
  return NOTE_LINK_PREFIX + noteId;
}

/**
 * Parse either note link form. `journalName` is the path form's journal
 * segment (null for the stored form); never use it for resolution.
 */
export function parseNoteLink(
  url: string,
): { noteId: string; journalName: string | null } | null {
  if (!url) return null;

  const stored = url.match(storedRegex);
  if (stored) return { noteId: stored[1], journalName: null };

  const match = url.match(pathRegex);
  if (!match || !match[1] || !match[2]) return null;
  return { noteId: match[2], journalName: match[1] };
}

/** Rewrite a path-form note link to the stored form; other URLs → undefined. */
export function toStoredNoteLink(url: string): string | undefined {
  const parsed = parseNoteLink(url);
  if (!parsed || parsed.journalName === null) return undefined;
  return noteLinkUrl(parsed.noteId);
}
