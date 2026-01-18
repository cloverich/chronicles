import * as mdast from "mdast";
import { TElement, TText } from "platejs";

export function toUndefined<T>(value: T | undefined | null): T | undefined {
  return value ?? undefined;
}

// One of the main reasons this fork exists:
// NOTE: https://github.com/inokawa/remark-slate-transformer/issues/31

// NOTE: added, and a good example of what changes I would want to make to this library!
import {
  ELEMENT_CODE_BLOCK,
  ELEMENT_CODE_LINE,
  ELEMENT_LI,
  ELEMENT_LIC,
  ELEMENT_LINK,
  ELEMENT_OL,
  ELEMENT_UL,
} from "../../../views/edit/plate-types";

import {
  createImageGalleryElement,
  SlateImageGallery,
} from "../../../views/edit/editorv2/features/images";
import {
  createImage,
  Image,
  Video,
} from "../../../views/edit/editorv2/features/images/toMdast";
import {
  SlateNoteLink,
  toSlateNoteLink,
} from "../../../views/edit/editorv2/features/note-linking/toMdast";

export type Decoration = {
  [key in (
    | mdast.Emphasis
    | mdast.Strong
    | mdast.Delete
    | mdast.InlineCode
  )["type"]]?: true;
};

export interface BaseElement extends TElement {}

export function mdastToSlate(node: mdast.Root): SlateNode[] {
  // Convert nodes, and ensure only block-level nodes are present
  // at the top level
  const nodes = convertNodes(node.children, {}).map((node) => {
    // Wrap any leaf nodes in paragraph; assumes leaf nodes are all
    // text or marks (emphasis, bold, etc)
    if (!("children" in node)) {
      return {
        type: "p",
        children: [node],
      } as Paragraph;
    } else {
      return node;
    }
  });

  // Ensure always at least one
  if (nodes.length === 0) {
    return [
      {
        type: "p",
        children: [{ text: "" }],
      },
    ];
  }

  // Ensure a trailing paragraph is always present; when final node is
  // non-editable (like image), user will have no (obvious) way to enter
  // new text lines
  if (nodes[nodes.length - 1].type !== "p") {
    nodes.push({
      type: "p",
      children: [{ text: "" }],
    });
  }

  return nodes;
}

// recursively convert block-level and leaf nodes
function convertNodes(nodes: mdast.Content[], deco: Decoration): SlateNode[] {
  if (nodes.length === 0) {
    return [{ text: "" }];
  }

  return nodes.reduce<SlateNode[]>((acc, node) => {
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
    // todo: See comment on createListItem; unless the _mdast_ type is "lic", I don't think this should be
    // leaking beyond the slate DOM (i.e. why do the types / code history say its present in mdast?)
    case ELEMENT_LIC as any:
      return [createListItem(node as any, deco)];
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
    case "imageGalleryElement":
      return [createImageGalleryElement({ node, convertNodes, deco })];
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
      console.warn("mdastToSlate: Unsupported node type:", node.type);
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

export interface Paragraph extends BaseElement {
  type: "p";
}

function createParagraph(node: mdast.Paragraph, deco: Decoration): Paragraph {
  const { type, children } = node;
  return {
    type: "p", // NOTE: plate's DOM expects `p`, not `paragraph`
    children: convertNodes(children, deco),
  };
}

export interface Heading extends BaseElement {
  type: "h1" | "h2" | "h3";
  depth: number;
}

function depthToHeading(depth: number): Heading["type"] {
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

function createHeading(node: mdast.Heading, deco: Decoration): Heading {
  const { type, children, depth } = node;

  return {
    // mdast uses "heading" + depth; our slate implementation
    // uses "h1", "h2", etc
    type: depthToHeading(depth),
    depth,
    children: convertNodes(children, deco),
  };
}

export interface ThematicBreak extends BaseElement {
  type: "thematicBreak";
}

function createThematicBreak(node: mdast.ThematicBreak): ThematicBreak {
  return {
    type: node.type,
    children: [{ text: "" }],
  };
}

export interface BlockQuote extends BaseElement {
  type: "blockquote";
}

function createBlockquote(
  node: mdast.Blockquote,
  deco: Decoration,
): BlockQuote {
  return {
    type: node.type,
    children: convertNodes(node.children, deco),
  };
}

export interface List extends BaseElement {
  type: "ol" | "ul";
  ordered?: boolean | null;
  start?: number | null;
  spread?: boolean | null;
}

function createList(node: mdast.List, deco: Decoration): List {
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

export interface ListItem extends BaseElement {
  // todo: Plate seems to receieve ELEMENT_LIC....we should not need both...
  // re-work plate version at some point
  type: "li" | "lic";
  checked?: boolean | null;
  spread?: boolean | null;
}

type MdastListItemChild = Omit<mdast.ListItem, "type"> & { type: "lic" };

function createListItem(
  node: mdast.ListItem | MdastListItemChild,
  deco: Decoration,
): ListItem {
  const { type, children, checked, spread } = node;

  if (type === ELEMENT_LIC) {
    return {
      type: ELEMENT_LIC,
      // todo: idk why have to cast here.
      children: convertNodes(children as mdast.Content[], deco),
    };
  }

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

export interface Table extends BaseElement {
  type: "table";
  align?: mdast.AlignType[] | null;
}

function createTable(node: mdast.Table, deco: Decoration): Table {
  const { type, children, align } = node;
  return {
    type,
    children: convertNodes(children, deco),
    align,
  };
}

export interface TableRow extends BaseElement {
  type: "tableRow";
}

function createTableRow(node: mdast.TableRow, deco: Decoration): TableRow {
  const { type, children } = node;
  return {
    type,
    children: convertNodes(children, deco),
  };
}

export interface TableCell extends BaseElement {
  type: "tableCell";
}

function createTableCell(node: mdast.TableCell, deco: Decoration): TableCell {
  const { type, children } = node;
  return {
    type,
    children: convertNodes(children, deco),
  };
}

export interface Html extends BaseElement {
  type: "html";
}

function createHtml(node: mdast.HTML): Html {
  const { type, value } = node;
  return {
    type,
    children: [{ text: value }],
  };
}

export interface Code extends BaseElement {
  type: "code_block";
  lang?: string | null;
  meta: any; // shrug
  children: [
    {
      type: "code_line";
      text: string;
    },
  ];
}

function createCodeBlock(node: mdast.Code): Code {
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

export interface Definition extends BaseElement {
  type: "definition";
  identifier: string;
  label?: string | null;
  url: string;
  title?: string | null;
}

function createDefinition(node: mdast.Definition): Definition {
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

export interface FootnoteDefinition extends BaseElement {
  type: "footnoteDefinition";
  identifier: string;
  label?: string | null;
}

function createFootnoteDefinition(
  node: mdast.FootnoteDefinition,
  deco: Decoration,
): FootnoteDefinition {
  const { type, children, identifier, label } = node;
  return {
    type,
    children: convertNodes(children, deco),
    identifier,
    label,
  };
}

// export interface Text extends Decoration {
//   text: string;
// }

function createText(text: string, deco: Decoration): TText {
  return {
    ...deco,
    text,
  };
}

export interface Break extends BaseElement {
  type: "break";
}

function createBreak(node: mdast.Break): Break {
  return {
    type: node.type,
    children: [{ text: "" }],
  };
}

export interface Link extends BaseElement {
  type: "a";
  url: string;
  title?: string | null;
}

function createLink(node: mdast.Link, deco: Decoration): Link | SlateNoteLink {
  const { children, url, title } = node;

  const res = toSlateNoteLink({
    url,
    children,
    deco,
    convertNodes,
  });

  if (res) return res;

  return {
    type: ELEMENT_LINK,
    children: convertNodes(children, deco),
    url,
    title,
  };
}

export interface LinkReference extends BaseElement {
  type: "linkReference";
  referenceType: mdast.ReferenceType;
  identifier: string;
  label?: string | null;
}

function createLinkReference(
  node: mdast.LinkReference,
  deco: Decoration,
): LinkReference {
  const { type, children, referenceType, identifier, label } = node;
  return {
    type,
    children: convertNodes(children, deco),
    referenceType,
    identifier,
    label,
  };
}

export interface ImageReference extends BaseElement {
  type: "imageReference";
  alt?: string | null;
  referenceType: mdast.ReferenceType;
  identifier: string;
  label?: string | null;
}

function createImageReference(node: mdast.ImageReference): ImageReference {
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

export interface FootnoteReference extends BaseElement {
  type: "footnoteReference";
  identifier: string;
  label?: string | null;
}

function createFootnoteReference(
  node: mdast.FootnoteReference,
): FootnoteReference {
  const { type, identifier, label } = node;
  return {
    type,
    identifier,
    label,
    children: [{ text: "" }],
  };
}

export type SlateNode =
  | BaseElement
  | Paragraph
  | Heading
  | ThematicBreak
  | BlockQuote
  | List
  | ListItem
  | Table
  | TableRow
  | TableCell
  | TText
  | Html
  | Code
  // | Yaml
  // | Toml
  | Definition
  | FootnoteDefinition
  | FootnoteReference
  | Break
  | Link
  | Image
  | Video
  | LinkReference
  | SlateImageGallery
  | SlateNoteLink
  | ImageReference;
