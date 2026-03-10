import mdast from "mdast";
import {
  BaseElement,
  SlateNode,
} from "./remark-slate-transformer/transformers/mdast-to-slate";

export const ELEMENT_NOTE_LINK = "noteLinkElement";

export interface INoteLinkElement extends BaseElement {
  title: string;
  noteId: string;
  journalName: string;
}

/**
 * Convert a NoteLinkElement to a standard MDAST link (i.e. Slate -> MDAST).
 */
export function toMdastLinkFactory(convertNodes: (nodes: SlateNode[]) => any) {
  return function toMdastLink(node: INoteLinkElement): mdast.Link {
    const { noteId, journalName, children } = node;
    const url = `../${journalName}/${noteId}.md`;

    return {
      type: "link",
      url,
      title: null,
      children: convertNodes(children),
    };
  };
}

const noteLinkRegex = /^\..\/(?:(.+)\/)?([a-zA-Z0-9-]+)\.md$/;

export function parseNoteLink(url: string) {
  if (!url) return null;

  const match = url.match(noteLinkRegex);
  const journalName = match ? match[1] : null;
  const noteId = match ? match[2] : null;
  if (!noteId || !journalName) return null;
  return { noteId, journalName };
}

export interface SlateNoteLink extends BaseElement {
  type: typeof ELEMENT_NOTE_LINK;
  title: string;
  url: string;
  noteId: string;
  journalName: string;
}

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

export function toSlateNoteLink({
  url,
  convertNodes,
  deco,
  children,
}: {
  url: string;
  convertNodes: any;
  deco: any;
  children: any;
}): SlateNoteLink | undefined {
  const res = parseNoteLink(url);

  if (res) {
    const title = extractTextFromChildren(children);

    return {
      type: ELEMENT_NOTE_LINK,
      children: convertNodes(children, deco),
      title,
      url,
      noteId: res.noteId,
      journalName: res.journalName,
    };
  }
}
