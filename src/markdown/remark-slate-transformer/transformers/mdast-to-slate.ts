import * as mdast from "mdast";
import * as slate from "slate";

function toUndefined<T>(value: T | undefined | null): T | undefined {
  return value ?? undefined;
}

// One of the main reasons this fork exists:
// NOTE: https://github.com/inokawa/remark-slate-transformer/issues/31
import { prefixUrl, videoExtensions } from "../../../hooks/images";

// NOTE: added, and a good example of what changes I would want to make to this library!
import {
  ELEMENT_CODE_BLOCK,
  ELEMENT_CODE_LINE,
  ELEMENT_LI,
  ELEMENT_LIC,
  ELEMENT_LINK,
  ELEMENT_OL,
  ELEMENT_UL,
} from "@udecode/plate"; // todo: sub-package which has only elements?

import { toSlateNoteLink } from "../../../views/edit/editor/features/note-linking/toMdast";

export type Decoration = {
  [key in (
    | mdast.Emphasis
    | mdast.Strong
    | mdast.Delete
    | mdast.InlineCode
  )["type"]]?: true;
};

export function mdastToSlate(node: mdast.Root): slate.Node[] {
  return createSlateRoot(node);
}

function createSlateRoot(root: mdast.Root): slate.Node[] {
  return convertNodes(root.children, {});
}

function convertNodes(nodes: mdast.Content[], deco: Decoration): slate.Node[] {
  if (nodes.length === 0) {
    return [{ text: "" }];
  }

  return nodes.reduce<slate.Node[]>((acc, node) => {
    acc.push(...createSlateNode(node, deco));
    return acc;
  }, []);
}

const DECORATION_MAPPING = {
  emphasis: "italic",
  strong: "bold",
  delete: "strikethrough",
  inlineCode: "code",
};

function createSlateNode(node: mdast.Content, deco: Decoration): SlateNode[] {
  switch (node.type) {
    case "paragraph":
      return [createParagraph(node, deco)];
    case "heading":
      return [createHeading(node, deco)];
    case "thematicBreak":
      return [createThematicBreak(node)];
    case "blockquote":
      return [createBlockquote(node, deco)];
    case "list":
      return [createList(node, deco)];
    case "listItem":
      return [createListItem(node, deco)];
    case ELEMENT_LIC as any:
      return [createListItemChild(node, deco)];
    case "table":
      return [createTable(node, deco)];
    case "tableRow":
      return [createTableRow(node, deco)];
    case "tableCell":
      return [createTableCell(node, deco)];
    case "html":
      return [createHtml(node)];
    case "code":
      return [createCodeBlock(node)];
    // case "yaml":
    //   return [createYaml(node)];
    // case "toml":
    //   return [createToml(node)];
    case "definition":
      return [createDefinition(node)];
    case "footnoteDefinition":
      return [createFootnoteDefinition(node, deco)];
    case "text":
      return [createText(node.value, deco)];
    case "emphasis":
    case "strong":
    case "delete": {
      const { type, children } = node;
      return children.reduce<SlateNode[]>((acc, n) => {
        acc.push(
          ...createSlateNode(n, { ...deco, [DECORATION_MAPPING[type]]: true }),
        );
        return acc;
      }, []);
    }
    case "inlineCode": {
      const { type, value } = node;
      return [createText(value, { ...deco, [DECORATION_MAPPING[type]]: true })];
    }
    case "break":
      return [createBreak(node)];
    case "link":
      return [createLink(node, deco)];
    case "image":
      return [createImage(node)];
    case "linkReference":
      return [createLinkReference(node, deco)];
    case "imageReference":
      return [createImageReference(node)];
    // case "footnote":
    //   return [createFootnote(node, deco)];
    case "footnoteReference":
      return [createFootnoteReference(node)];
    // case "math":
    //   return [createMath(node)];
    // case "inlineMath":
    //   return [createInlineMath(node)];
    // case "yaml":
    case "ofmWikiembedding":
      return [createTextFromWikiLink(node)];
    case "ofmWikilink":
      return [createTextFromWikiLink(node)];
    default:
      // const _: never = node;
      break;
  }
  return [];
}

// NOTE: We added parsing of ofmWikiLinks so we can turn them into regular markdown links
// on import; but we don't directly support them in the editor. Here we transform them into
// plain text nodes, and when serialized back to markdown, they'll end up as e.g.
// \[\[MyWikiLink]] - which will be parsed as regular text thereafter.
// In practice; we generally shouldn't see wikilinks in Chronicles since we try to convert
// them all in import; but if we dont, better to do this than die confusingly.
function createTextFromWikiLink(
  node: mdast.OfmWikilink | mdast.OfmWikiEmbedding,
) {
  // Given the parsed parts, reconstruct the original link:
  // <url>#<hash>|<value> - [[my_file.md#my_header|A prettier name]]
  let { type, url, hash, value } = node;

  value = value ?? "";
  url = url ?? "";

  // Hash is optionally joined, if present
  let namePart = url;
  namePart = [namePart, hash].filter(Boolean).join("#");

  // The library sets the url and value (alias) to the same thing, stripping the
  // trailing extension (link.md -> link),  when no alias is present. So if they don't (sub)match,
  // assume the alias differs and we should serialize as <name>|<alias>; otherwise we discard the alias.
  if (!url.includes(value)) {
    namePart = `${namePart}|${value}`;
  }

  // wrap in brackets
  let text = `[[${namePart}]]`;

  // Because this function handles both, prepend with ! if its an embedding.
  if (type === "ofmWikiembedding") {
    text = `!${text}`;
  }

  return { text };
}

export type Paragraph = ReturnType<typeof createParagraph>;

function createParagraph(node: mdast.Paragraph, deco: Decoration) {
  const { type, children } = node;
  return {
    type: "p", // NOTE: plate's DOM expects `p`, not `paragraph`
    children: convertNodes(children, deco),
  };
}

export type Heading = ReturnType<typeof createHeading>;

function depthToHeading(depth: number): string {
  // stylistic choice: limit depth to h3
  switch (depth) {
    case 1:
      return "h1";
    case 2:
      return "h2";
    default:
      return "h3";
  }
}

function createHeading(node: mdast.Heading, deco: Decoration) {
  const { type, children, depth } = node;

  return {
    // mdast uses "heading" + depth; our slate implementation
    // uses "h1", "h2", etc
    type: depthToHeading(depth),
    depth,
    children: convertNodes(children, deco),
  };
}

export type ThematicBreak = ReturnType<typeof createThematicBreak>;

function createThematicBreak(node: mdast.ThematicBreak) {
  return {
    type: node.type,
    children: [{ text: "" }],
  };
}

export type Blockquote = ReturnType<typeof createBlockquote>;

function createBlockquote(node: mdast.Blockquote, deco: Decoration) {
  return {
    type: node.type,
    children: convertNodes(node.children, deco),
  };
}

export type List = ReturnType<typeof createList>;

function createList(node: mdast.List, deco: Decoration) {
  const { type, children, ordered, start, spread } = node;

  return {
    // type is "list" in mdast, but slate expects "ol" or "ul"
    type: ordered ? ELEMENT_OL : ELEMENT_UL,
    children: convertNodes(children, deco),
    ordered,
    start,
    spread,
  };
}

export type ListItem = ReturnType<typeof createListItem>;

function createListItem(node: mdast.ListItem, deco: Decoration) {
  const { type, children, checked, spread } = node;

  // NOTE: Added
  // Plate li children must have an lic type unless they are another list,
  // otherwise the plugin does really wierd stuff
  children.forEach((child) => {
    child.type = child.type === "paragraph" ? ELEMENT_LIC : (child.type as any);
  });

  return {
    type: ELEMENT_LI,
    children: convertNodes(children, deco),
    checked,
    spread,
  };
}

// NOTE: Added this custom to create ELEMENT_LIC according to plates custom list item handling...
function createListItemChild(node: any, deco: Decoration) {
  // NOTE: shrug see notes in createListItem
  const { type, children } = node;

  return {
    type: ELEMENT_LIC,
    children: convertNodes(children, deco),
  };
}

export type Table = ReturnType<typeof createTable>;

function createTable(node: mdast.Table, deco: Decoration) {
  const { type, children, align } = node;
  return {
    type,
    children: convertNodes(children, deco),
    align,
  };
}

export type TableRow = ReturnType<typeof createTableRow>;

function createTableRow(node: mdast.TableRow, deco: Decoration) {
  const { type, children } = node;
  return {
    type,
    children: convertNodes(children, deco),
  };
}

export type TableCell = ReturnType<typeof createTableCell>;

function createTableCell(node: mdast.TableCell, deco: Decoration) {
  const { type, children } = node;
  return {
    type,
    children: convertNodes(children, deco),
  };
}

export type Html = ReturnType<typeof createHtml>;

function createHtml(node: mdast.HTML) {
  const { type, value } = node;
  return {
    type,
    children: [{ text: value }],
  };
}

export type Code = ReturnType<typeof createCodeBlock>;

function createCodeBlock(node: mdast.Code) {
  const { value, lang, meta } = node;

  return {
    type: ELEMENT_CODE_BLOCK,
    lang,
    meta,
    // MDAST represents code blocks as a single string; our Plate code block represents
    // internal code as a code_line element. Ostensibly this should be each line, but
    // the PlateDOM seems to convert the full text to a single code_line element when it is modified.
    children: [{ type: ELEMENT_CODE_LINE, text: value }],
  };
}

// export type Yaml = ReturnType<typeof createYaml>;

// function createYaml(node: mdast.YAML) {
//   const { type, value } = node;
//   return {
//     type,
//     children: [{ text: value }],
//   };
// }

// export type Toml = ReturnType<typeof createToml>;

// function createToml(node: mdast.TOML) {
//   const { type, value } = node;
//   return {
//     type,
//     children: [{ text: value }],
//   };
// }

// export type Math = ReturnType<typeof createMath>;

// function createMath(node: mdast.Math) {
//   const { type, value } = node;
//   return {
//     type,
//     children: [{ text: value }],
//   };
// }

// export type InlineMath = ReturnType<typeof createInlineMath>;

// function createInlineMath(node: mdast.InlineMath) {
//   const { type, value } = node;
//   return {
//     type,
//     children: [{ text: value }],
//   };
// }

export type Definition = ReturnType<typeof createDefinition>;

function createDefinition(node: mdast.Definition) {
  const { type, identifier, label, url, title } = node;
  return {
    type,
    identifier,
    label,
    url,
    title,
    children: [{ text: "" }],
  };
}

export type FootnoteDefinition = ReturnType<typeof createFootnoteDefinition>;

function createFootnoteDefinition(
  node: mdast.FootnoteDefinition,
  deco: Decoration,
) {
  const { type, children, identifier, label } = node;
  return {
    type,
    children: convertNodes(children, deco),
    identifier,
    label,
  };
}

export type Text = ReturnType<typeof createText>;

function createText(text: string, deco: Decoration) {
  return {
    ...deco,
    text,
  };
}

export type Break = ReturnType<typeof createBreak>;

function createBreak(node: mdast.Break) {
  return {
    type: node.type,
    children: [{ text: "" }],
  };
}

export type Link = ReturnType<typeof createLink>;

function createLink(node: mdast.Link, deco: Decoration) {
  const { children, url, title } = node;

  const res = toSlateNoteLink({ url, children, deco, convertNodes });

  if (res) return res;

  return {
    type: ELEMENT_LINK,
    children: convertNodes(children, deco),
    url,
    title,
  };
}

export type Image = {
  type: "img";
  url: string;
  title?: string;
  alt?: string;
  caption?: [{ text: string }];
  children: [{ text: "" }];
};

export type Video = {
  type: "video";
  url: string;
  title?: string;
  alt?: string;
  caption?: [{ text: string }];
  children: [{ text: "" }];
};

/**
 * Handle image AND video nodes
 */
function createImage(node: mdast.Image): Image | Video {
  const { type, url, title, alt } = node;

  // In slate-to-mdast, we encode video nodes as images, and rely on
  // the file extension here to determine if it's a video or not
  const extension = (url?.split(".").pop() || "").toLowerCase();
  if (videoExtensions.includes(extension)) {
    return {
      type: "video",
      url: prefixUrl(url),
      title: toUndefined(title),
      alt: toUndefined(alt),
      // NOTE: Plate uses "caption" for alt (createCaptionPlugin + CaptionElement)
      caption: [{ text: alt || "" }],
      children: [{ text: "" }],
    };
  }

  return {
    // NOTE: I changed this from simply type, which forwarded the incoming "image" type,
    // to "img", which plate expects
    type: "img",
    // NOTE: I modify url's here which is a bit silly but i'm in hack-it-in mode so :|
    url: prefixUrl(url),
    title: toUndefined(title),
    alt: toUndefined(alt),
    // NOTE: Plate uses "caption" for alt (createCaptionPlugin + CaptionElement)
    caption: [{ text: alt || "" }],
    // NOTE: All slate nodes need text children
    children: [{ text: "" }],
  };
}

export type LinkReference = ReturnType<typeof createLinkReference>;

function createLinkReference(node: mdast.LinkReference, deco: Decoration) {
  const { type, children, referenceType, identifier, label } = node;
  return {
    type,
    children: convertNodes(children, deco),
    referenceType,
    identifier,
    label,
  };
}

export type ImageReference = ReturnType<typeof createImageReference>;

function createImageReference(node: mdast.ImageReference) {
  const { type, alt, referenceType, identifier, label } = node;
  return {
    type,
    alt,
    referenceType,
    identifier,
    label,
    children: [{ text: "" }],
  };
}

// export type Footnote = ReturnType<typeof createFootnote>;

// function createFootnote(node: mdast.Footnote, deco: Decoration) {
//   const { type, children } = node;
//   return {
//     type,
//     children: convertNodes(children, deco),
//   };
// }

export type FootnoteReference = ReturnType<typeof createFootnoteReference>;

function createFootnoteReference(node: mdast.FootnoteReference) {
  const { type, identifier, label } = node;
  return {
    type,
    identifier,
    label,
    children: [{ text: "" }],
  };
}

export type SlateNode =
  | Paragraph
  | Heading
  | ThematicBreak
  | Blockquote
  | List
  | ListItem
  | Table
  | TableRow
  | TableCell
  | Html
  | Code
  // | Yaml
  // | Toml
  | Definition
  | FootnoteDefinition
  | Text
  | Break
  | Link
  | Image
  | Video
  | LinkReference
  | ImageReference

  // NOTE: I add this because convertNodes claims it wants only SlateNode, but some convertNodes
  // calls here return slate.Node[]... so I need to unify these types somehow.
  | slate.Node;
// | Footnote
// | FootnoteReference
// | Math
// | InlineMath;
