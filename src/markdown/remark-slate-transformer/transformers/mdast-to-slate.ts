import * as slate from "../models/slate";
import * as mdast from "../models/mdast";

// One of the main reasons this fork exists:
// NOTE: https://github.com/inokawa/remark-slate-transformer/issues/31
import { prefixUrl } from "../../../hooks/images";

// NOTE: added, and a good example of what changes I would want to make to this library!
import {
  ELEMENT_LI,
  ELEMENT_LIC,
  ELEMENT_OL,
  ELEMENT_TODO_LI,
  ELEMENT_UL,
  ELEMENT_CODE_BLOCK,
} from "@udecode/plate"; // todo: sub-package which has only elements?

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

// NOTE: Added
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
      return [createCode(node)];
    case "yaml":
      return [createYaml(node)];
    case "toml":
      return [createToml(node)];
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
    case "footnote":
      return [createFootnote(node, deco)];
    case "footnoteReference":
      return [createFootnoteReference(node)];
    case "math":
      return [createMath(node)];
    case "inlineMath":
      return [createInlineMath(node)];
    default:
      const _: never = node;
      break;
  }
  return [];
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

function createHeading(node: mdast.Heading, deco: Decoration) {
  const { type, children, depth } = node;

  return {
    // see slate-to-mdast heading conversion
    // mdast deals in type: "heading" with depth, but
    // slate (and actually, I think Plate) want type to be
    // "h1", "h2", etc. I only have toolbar buttons for h1 and h2
    // so I default to h2 if its not h1
    type: depth === 1 ? "h1" : "h2",
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
    type: ordered ? ELEMENT_OL : ELEMENT_UL, // todo: support check list items? No, support those via different function
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

export type Code = ReturnType<typeof createCode>;

function createCode(node: mdast.Code) {
  const { type, value, lang, meta } = node;
  return {
    type: ELEMENT_CODE_BLOCK,
    lang,
    meta,
    children: [{ text: value }],
  };
}

export type Yaml = ReturnType<typeof createYaml>;

function createYaml(node: mdast.YAML) {
  const { type, value } = node;
  return {
    type,
    children: [{ text: value }],
  };
}

export type Toml = ReturnType<typeof createToml>;

function createToml(node: mdast.TOML) {
  const { type, value } = node;
  return {
    type,
    children: [{ text: value }],
  };
}

export type Math = ReturnType<typeof createMath>;

function createMath(node: mdast.Math) {
  const { type, value } = node;
  return {
    type,
    children: [{ text: value }],
  };
}

export type InlineMath = ReturnType<typeof createInlineMath>;

function createInlineMath(node: mdast.InlineMath) {
  const { type, value } = node;
  return {
    type,
    children: [{ text: value }],
  };
}

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
  const { type, children, url, title } = node;
  return {
    type: "a", // NOTE: Default plate link component uses "a"
    children: convertNodes(children, deco),
    url,
    title,
  };
}

export type Image = ReturnType<typeof createImage>;

function createImage(node: mdast.Image) {
  const { type, url, title, alt } = node;
  return {
    // NOTE: I changed this from simply type, which forwarded the incoming "image" type,
    // to "img", which plate expects
    type: "img",
    // NOTE: I modify url's here which is a bit silly but i'm in hack-it-in mode so :|
    url: prefixUrl(url),
    title,
    alt,
    // NOTE: Plate uses "caption" for alt
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

export type Footnote = ReturnType<typeof createFootnote>;

function createFootnote(node: mdast.Footnote, deco: Decoration) {
  const { type, children } = node;
  return {
    type,
    children: convertNodes(children, deco),
  };
}

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
  | Yaml
  | Toml
  | Definition
  | FootnoteDefinition
  | Text
  | Break
  | Link
  | Image
  | LinkReference
  | ImageReference
  | Footnote
  | FootnoteReference
  | Math
  | InlineMath;
