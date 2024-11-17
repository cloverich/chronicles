import mdast from "mdast";
import { Node } from "../../../../../markdown/remark-slate-transformer/models/slate";
import { ELEMENT_NOTE_LINK, INoteLinkElement } from "./NoteLinkElement";

/**
 * Convert a NoteLinkElement to a standard MDAST link (i.e. Slate -> MDAST).
 *
 * NoteLink's are only special in that they link to another note, i.e. .md rather
 * than a URL. So when we encode them to markdown, can just treat them as a standard
 * (file) link. Note that _how_ they are encoded is tightly coupled to the feature, because
 * we expect to parse them back into NoteLinkElements.
 */
export function toMdastLinkFactory(convertNodes: (nodes: Node[]) => any) {
  return function toMdastLink(node: INoteLinkElement): mdast.Link {
    const { title, noteId, journalName, children } = node;

    // NOTE: This format assumes if notes were exported, the format of all notes would be
    // <basedir>/<journal>/<note_id>.md. While intra-journal linking could be simplified
    // to ./<note_id>.md, then we would need to update the links if the note was changed to
    // a different journal (which I do constantly).
    const url = `../${journalName}/${noteId}.md`;

    return {
      type: "link",
      url,
      title,
      children: convertNodes(children), // as any as mdast.Link["children"],
    } as any;
  };
}

// For parsing note links, i.e. the `./<journalName>/<noteId>.md` format.
const noteLinkRegex = /^\..\/(?:(.+)\/)?([a-zA-Z0-9-]+)\.md$/;

/**
 * Check if url conforms to the note link format.
 *
 * ex: `../journal/note_id.md`
 *
 */
export function checkNoteLink(url: string) {
  if (!url) return null;

  const match = url.match(noteLinkRegex);
  const journalName = match ? match[1] : null;
  const noteId = match ? match[2] : null;
  if (!noteId || !journalName) return null;
  return { noteId, journalName };
}

interface ToSlateLink {
  url: string;
  convertNodes: any;
  deco: any;
  children: any;
}

/**
 * Converts a markdown link to a NoteLink, if it points to a markdown file.
 */
export function toSlateNoteLink({
  url,
  convertNodes,
  deco,
  children,
}: ToSlateLink) {
  const res = checkNoteLink(url);

  if (res) {
    return {
      type: ELEMENT_NOTE_LINK,
      children: convertNodes(children, deco),
      title: "",
      // note: url is unused by NoteLinkElement, but the TS interface of Slate's link DOM
      // is declared as Link = ReturnType<typeof createLink>, so returning something different
      // here (i.e. omitting url) messed up that type. Technically we could return url here and
      // have the NoteLinkElement parse out the URL... but we have to detect type: ELEMENT_NOTE_LINK
      // here anyways so...
      url,
      noteId: res.noteId,
      journalName: res.journalName,
    };
  }
}
