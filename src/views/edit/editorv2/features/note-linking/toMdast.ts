import mdast from "mdast";
import {
  BaseElement,
  SlateNode,
} from "../../../../../markdown/remark-slate-transformer/transformers/mdast-to-slate";
import { ELEMENT_NOTE_LINK, INoteLinkElement } from "./NoteLinkElement";

/**
 * Convert a NoteLinkElement to a standard MDAST link (i.e. Slate -> MDAST).
 *
 * NoteLink's are only special in that they link to another note, i.e. .md rather
 * than a URL. So when we encode them to markdown, can just treat them as a standard
 * (file) link. Note that _how_ they are encoded is tightly coupled to the feature, because
 * we expect to parse them back into NoteLinkElements.
 */
export function toMdastLinkFactory(convertNodes: (nodes: SlateNode[]) => any) {
  return function toMdastLink(node: INoteLinkElement): mdast.Link {
    const { noteId, journalName, children } = node;

    // NOTE: This format assumes if notes were exported, the format of all notes would be
    // <basedir>/<journal>/<note_id>.md. While intra-journal linking could be simplified
    // to ./<note_id>.md, then we would need to update the links if the note was changed to
    // a different journal (which I do constantly).
    const url = `../${journalName}/${noteId}.md`;

    return {
      type: "link",
      url,
      // Note: title in MDAST is the tooltip text (e.g. [text](url "title")), not the link text.
      // For note links, we only use the link text (children) - the title property on the Slate
      // element is for display purposes only.
      title: null,
      children: convertNodes(children), // as any as mdast.Link["children"],
    };
  };
}

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

interface ToSlateNoteLink {
  url: string;
  convertNodes: any;
  deco: any;
  children: any;
}

export interface SlateNoteLink extends BaseElement {
  type: "noteLinkElement";
  title: string;
  url: string;
  noteId: string;
  journalName: string;
}

/**
 * Extract text content from MDAST children nodes.
 */
function extractTextFromChildren(children: any[]): string {
  if (!children || children.length === 0) return "";
  return children
    .map((child: any) => {
      if (child.type === "text") return child.value;
      if (child.children) return extractTextFromChildren(child.children);
      return "";
    })
    .join("");
}

/**
 * Converts a markdown link to a NoteLink, if it points to a markdown file.
 */
export function toSlateNoteLink({
  url,
  convertNodes,
  deco,
  children,
}: ToSlateNoteLink): SlateNoteLink | undefined {
  const res = parseNoteLink(url);

  if (res) {
    // Extract title text from the link's children (the link text in markdown)
    const title = extractTextFromChildren(children);

    return {
      type: ELEMENT_NOTE_LINK,
      children: convertNodes(children, deco),
      title,
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
