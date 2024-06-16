import * as unistLib from "unist";
import * as slate from "../models/slate";
import * as mdast from "../models/mdast";
import * as SlateNodes from "./mdast-to-slate";

import { Node as SNode } from "slate";

// One of the main reasons this fork exists:
// NOTE: https://github.com/inokawa/remark-slate-transformer/issues/31
import { unPrefixUrl } from "../../../hooks/images";

// NOTE: added, and a good example of what changes I would want to make to this library!
import {
  ELEMENT_LI,
  ELEMENT_LIC,
  ELEMENT_OL,
  ELEMENT_TODO_LI,
  ELEMENT_UL,
  ELEMENT_CODE_BLOCK,
} from "@udecode/plate"; // todo: sub-package which has only elements?

// NOTE: Changed these, they were just mirroring mdasts' before
// which doesn't make sense
type DecorationType = keyof Decoration;

type Decoration = {
  italic: true | undefined;
  bold: true | undefined;
  strikethrough: true | undefined;
  code: true | undefined;
};

const DecorationMapping = {
  italic: "emphasis",
  bold: "strong",
  strikethrough: "delete",
  code: "inlineCode",
};

type TextOrDecoration =
  | mdast.Text
  | mdast.Emphasis
  | mdast.Strong
  | mdast.Delete
  | mdast.InlineCode;

export function slateToMdast(node: slate.Node): unistLib.Node {
  return createMdastRoot(node);
}

function createMdastRoot(node: slate.Node): unistLib.Node {
  const root: mdast.Root = {
    type: "root",
    children: convertNodes((node as any).children) as mdast.Root["children"],
  };
  return root as any as unistLib.Node;
}

function convertNodes(nodes: slate.Node[]): unistLib.Node[] {
  const mdastNodes: unistLib.Node[] = [];
  let textQueue: SlateNodes.Text[] = [];
  for (let i = 0; i <= nodes.length; i++) {
    const n = nodes[i] as SlateNodes.SlateNode;
    if (n && isText(n)) {
      textQueue.push(n);
    } else {
      const mdastTexts: TextOrDecoration[] = [];
      const starts: DecorationType[] = [];
      let textTemp: string = "";
      for (let j = 0; j < textQueue.length; j++) {
        const cur: any = textQueue[j];
        textTemp += cur.text;

        const prevStartsStr = starts.toString();

        const prev: any = textQueue[j - 1];
        const next: any = textQueue[j + 1];
        const ends: DecorationType[] = [];
        Object.keys(DecorationMapping).forEach((k: any) => {
          if (cur[k]) {
            if (!prev || !prev[k]) {
              starts.push(k);
            }
            if (!next || !next[k]) {
              ends.push(k);
            }
          }
        });

        const endsToRemove = starts.reduce<
          { key: DecorationType; index: number }[]
        >((acc, k, kIndex) => {
          if (ends.includes(k)) {
            acc.push({ key: k, index: kIndex });
          }
          return acc;
        }, []);

        if (starts.length > 0) {
          let bef = "";
          let aft = "";
          if (
            endsToRemove.length === 1 &&
            prevStartsStr !== starts.toString() &&
            starts.length - endsToRemove.length === 0
          ) {
            while (textTemp.startsWith(" ")) {
              bef += " ";
              textTemp = textTemp.slice(1);
            }
            while (textTemp.endsWith(" ")) {
              aft += " ";
              textTemp = textTemp.slice(0, -1);
            }
          }
          let res: TextOrDecoration = {
            type: "text",
            value: textTemp,
          };
          textTemp = "";
          const startsReversed = starts.slice().reverse();
          startsReversed.forEach((k) => {
            switch (k) {
              case "code":
                res = {
                  type: "inlineCode",
                  value: (res as any).value,
                };
                break;
              case "bold":
              case "italic":
              case "strikethrough":
                res = {
                  type: DecorationMapping[k] as any,
                  children: [res],
                };
                break;
              default:
                const _: never = k;
                break;
            }
          });
          const arr: TextOrDecoration[] = [];
          if (bef.length > 0) {
            arr.push({ type: "text", value: bef });
          }
          arr.push(res);
          if (aft.length > 0) {
            arr.push({ type: "text", value: aft });
          }
          mdastTexts.push(...arr);
        }

        if (endsToRemove.length > 0) {
          endsToRemove.reverse().forEach((e) => {
            starts.splice(e.index, 1);
          });
        } else {
          mdastTexts.push({ type: "text", value: textTemp });
          textTemp = "";
        }
      }
      if (textTemp) {
        mdastTexts.push({ type: "text", value: textTemp });
        textTemp = "";
      }

      mdastNodes.push(...(mergeTexts(mdastTexts) as any as unistLib.Node[]));
      textQueue = [];
      if (!n) continue;
      const node = createMdastNode(n);
      if (node) {
        mdastNodes.push(node as unistLib.Node);
      }
    }
  }

  return mdastNodes;
}

function createMdastNode(
  node: any, //Exclude<slateInternal.SlateNode, slateInternal.Text> --> as any because the switch thinks node.type is a string
): Exclude<mdast.Content, TextOrDecoration> | null {
  switch (node.type) {
    case ELEMENT_LIC: // NOTE: added.
    case "paragraph":
    case "p":
      return createParagraph(node);

    // NOTE: Slate claims type is only ever "heading", but
    // I see  "h1", "h2", etc, for type. Maybe Plate plugin doing this.
    case "heading":
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
      return createHeading(node);
    case "thematicBreak":
      return createThematicBreak(node);
    case "blockquote":
      return createBlockquote(node);
    case "list":
    case ELEMENT_UL: // NOTE: added
    case ELEMENT_OL: // NOTE: added
      return createList(node);
    case "listItem":
    case ELEMENT_LI: // NOTE: added
      return createListItem(node);
    case "table":
      return createTable(node);
    case "tableRow":
      return createTableRow(node);
    case "tableCell":
      return createTableCell(node);
    case "html":
      return createHtml(node);
    case "code": // NOTE: don't think this is used by plate
    case ELEMENT_CODE_BLOCK:
      return createCode(node);
    case "yaml":
      return createYaml(node);
    case "toml":
      return createToml(node);
    case "definition":
      return createDefinition(node);
    case "footnoteDefinition":
      return createFootnoteDefinition(node);
    case "break":
      return createBreak(node);
    case "link":
    case "a" as any: // NOTE: added "a" here
      return createLink(node);
    case "image":
    // NOTE: I MODIFIED next line to also catch img as image
    case "img":
    case "video":
      return createImage(node);
    case "linkReference":
      return createLinkReference(node);
    case "imageReference":
      return createImageReference(node);
    case "footnote":
      return createFootnote(node);
    case "footnoteReference":
      return creatFootnoteReference(node);
    case "math":
      return createMath(node);
    case "inlineMath":
      return createInlineMath(node);
    default:
      console.warn(
        "slateToMdast encountered unknown node type:",
        node,
        "If this is a custom node, it will not be converted to markdown (and likely not-persisted)",
      );
      // @ts-ignore
      const _: never = node;
      break;
  }
  return null;
}

function isText(node: SlateNodes.SlateNode): node is SlateNodes.Text {
  return "text" in node;
}

function mergeTexts(nodes: TextOrDecoration[]): TextOrDecoration[] {
  const res: TextOrDecoration[] = [];
  for (const cur of nodes) {
    const last = res[res.length - 1];
    if (last && last.type === cur.type) {
      if (last.type === "text") {
        last.value += (cur as typeof last).value;
      } else if (last.type === "inlineCode") {
        last.value += (cur as typeof last).value;
      } else {
        last.children = mergeTexts(
          last.children.concat(
            (cur as typeof last).children,
          ) as TextOrDecoration[],
        );
      }
    } else {
      if (cur.type === "text" && cur.value === "") continue;
      res.push(cur);
    }
  }
  return res;
}

function createParagraph(node: SlateNodes.Paragraph): mdast.Paragraph {
  const { type, children } = node;
  return {
    type: "paragraph",
    children: convertNodes(children) as any as mdast.Paragraph["children"],
  };
}

function createHeading(node: SlateNodes.Heading): mdast.Heading {
  const { type, depth, children } = node;
  return {
    type: "heading",
    // Slate claims "type" will always be "Heading", but its coming through as
    // "h1", "h2", etc. Probably the Plate plugin encoding it that way.
    depth: (type as string) === "h1" ? 1 : 2,
    children: convertNodes(children) as any as mdast.Heading["children"],
  };
}

function createThematicBreak(
  node: SlateNodes.ThematicBreak,
): mdast.ThematicBreak {
  const { type } = node;
  return {
    type,
  };
}

function createBlockquote(node: SlateNodes.Blockquote): mdast.Blockquote {
  const { type, children } = node;
  return {
    type,
    children: convertNodes(children) as any as mdast.Blockquote["children"],
  };
}

function createList(node: SlateNodes.List): mdast.List {
  const { type, ordered, start, spread, children } = node;

  return {
    // type is "ol" or "ul" in plate, but mdast expects "list"
    type: "list", // type: ol, ul
    ordered: type === "ol",
    start,
    spread,
    children: convertNodes(children) as any as mdast.List["children"],
  };
}

function createListItem(node: SlateNodes.ListItem): mdast.ListItem {
  const { type, checked, spread, children } = node;
  return {
    type: "listItem",
    checked,
    spread,
    children: convertNodes(children) as any as mdast.ListItem["children"],
  };
}

function createTable(node: SlateNodes.Table): mdast.Table {
  const { type, align, children } = node;
  return {
    type,
    align,
    children: convertNodes(children) as any as mdast.Table["children"],
  };
}

function createTableRow(node: SlateNodes.TableRow): mdast.TableRow {
  const { type, children } = node;
  return {
    type,
    children: convertNodes(children) as any as mdast.TableRow["children"],
  };
}

function createTableCell(node: SlateNodes.TableCell): mdast.TableCell {
  const { type, children } = node;
  return {
    type,
    children: convertNodes(children) as any as mdast.TableCell["children"],
  };
}

function createHtml(node: SlateNodes.Html): mdast.HTML {
  const { type, children } = node;
  return {
    type,
    value: children[0].text,
  };
}

/**
 * Convert a Slate/Plate code block ("code_block") to an MDAST code block ("code").
 *
 *
 * The slateInternal.Code type says its children are text nodes. However the
 * Plate code block is wraps them in a code_line element.
 * MDAST (seems to) expect just text in its code block element. This code
 * implements that. See the reverse transformation in mdast-to-slate.ts - createCodeBlock
 */
function createCode(node: SlateNodes.Code): mdast.Code {
  const { lang, meta } = node;

  // SNode.texts returns a generator that yields [{text: "foo"}, path] for each line
  // which looks like: [ { type: code_line, children : { text: ''}}]
  // TODO: Update Plate, then change the node's type
  const text = Array.from(SNode.texts(node))
    .map((item) => item[0].text)
    .join("\n")
    // Remove trailing newlines
    .replace(/\n+$/, "\n");

  return {
    type: "code",
    lang,
    meta,
    value: text,
  };
}

function createYaml(node: SlateNodes.Yaml): mdast.YAML {
  const { type, children } = node;
  return {
    type,
    value: children[0].text,
  };
}

function createToml(node: SlateNodes.Toml): mdast.TOML {
  const { type, children } = node;
  return {
    type,
    value: children[0].text,
  };
}

function createDefinition(node: SlateNodes.Definition): mdast.Definition {
  const { type, identifier, label, url, title } = node;
  return {
    type,
    identifier,
    label,
    url,
    title,
  };
}

function createFootnoteDefinition(
  node: SlateNodes.FootnoteDefinition,
): mdast.FootnoteDefinition {
  const { type, identifier, label, children } = node;
  return {
    type,
    identifier,
    label,
    children: convertNodes(
      children,
    ) as any as mdast.FootnoteDefinition["children"],
  };
}

function createBreak(node: SlateNodes.Break): mdast.Break {
  const { type } = node;
  return {
    type,
  };
}

function createLink(node: SlateNodes.Link): mdast.Link {
  const { type, url, title, children } = node;
  return {
    type: "link", // note: changes from type to type: "link" so it can accept "a", see the switch statement
    url, // note: converted, "as any" added because mdast.Link thinks its url and not link?
    title,
    children: convertNodes(children) as any as mdast.Link["children"],
  } as any;
}

function createImage(node: SlateNodes.Image | SlateNodes.Video): mdast.Image {
  const { type, url, title, alt } = node;
  return {
    // 1. Slate image may have type: "img" -- convert to something mdast understands
    // 2. I piggy back on image elements to handle video; incoming node my be video,
    // but store in markdown as an image (i.e. ![my cool video](some-video.mp4))
    // Requires the mdast-to-slate image transformer to reverse this
    type: "image",
    url: unPrefixUrl(url),
    title,

    // The actual alt property is a string, but its some hard-coded placeholder
    // "Here is a caption!". The caption you actually write, is stored in
    // { node: { caption: { text: 'What you wrote is here' }}}
    // Probably this is controlled by CaptionElement + createCaptionPlugin
    alt: node.caption
      ? node.caption.map((c: any) => SNode.string(c)).join("\n")
      : undefined,
  };
}

function createLinkReference(
  node: SlateNodes.LinkReference,
): mdast.LinkReference {
  const { type, identifier, label, referenceType, children } = node;
  return {
    type,
    identifier,
    label,
    referenceType,
    children: convertNodes(children) as any as mdast.LinkReference["children"],
  };
}

function createImageReference(
  node: SlateNodes.ImageReference,
): mdast.ImageReference {
  const { type, identifier, label, alt, referenceType } = node;
  return {
    type,
    identifier,
    label,
    alt,
    referenceType,
  };
}

function createFootnote(node: SlateNodes.Footnote): mdast.Footnote {
  const { type, children } = node;
  return {
    type,
    children: convertNodes(children) as any as mdast.Footnote["children"],
  };
}

function creatFootnoteReference(
  node: SlateNodes.FootnoteReference,
): mdast.FootnoteReference {
  const { type, identifier, label } = node;
  return {
    type,
    identifier,
    label,
  };
}

function createMath(node: SlateNodes.Math): mdast.Math {
  const { type, children } = node;
  return {
    type,
    value: children[0].text,
  };
}

function createInlineMath(node: SlateNodes.InlineMath): mdast.InlineMath {
  const { type, children } = node;
  return {
    type,
    value: children[0].text,
  };
}
