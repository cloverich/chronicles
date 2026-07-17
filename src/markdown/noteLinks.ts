// For parsing note links, i.e. the `./<journalName>/<noteId>.md` format.
const noteLinkRegex = /^\..\/(?:(.+)\/)?([a-zA-Z0-9-]+)\.md$/;

/**
 * Check if url conforms to the note link format.
 *
 * todo: fuse with isNoteLink in markdown/index.ts
 *
 * ex: `../journal/note_id.md`
 */
export function parseNoteLink(url: string) {
  if (!url) return null;

  const match = url.match(noteLinkRegex);
  const journalName = match ? match[1] : null;
  const noteId = match ? match[2] : null;
  if (!noteId || !journalName) return null;
  return { noteId, journalName };
}
