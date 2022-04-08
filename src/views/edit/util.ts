import { Element as SlateElement, Node as SlateNode } from "slate";
import { stringToSlate, slateToString, slateToMdast } from "../../markdown";

/**
 * Helper to convert markdown text into Slate nodes, and vice versa
 */
export class SlateTransformer {
  /**
   * Convert raw text to a Slate DOM
   */
  static nodify(text: string): SlateNode[] {
    // If content is empty, this call prdouces invalid output
    // ([{text: ""}]) instead of a paragraph with an empty child
    // Content should not be empty, but because of UI or other bugs can happen
    if (!text.trim()) return SlateTransformer.createEmptyNodes();

    // console.log("SlateTransformer.nodify: before string to slate: ", text);
    // console.log("SlateTransformer.nodify.stringToSlate", stringToSlate(text));
    return stringToSlate(text);
  }

  /**
   * Create an empty Slate DOM, intended for new empty documents.
   */
  static createEmptyNodes() {
    // todo: type: ELEMENT_P from plate, or better yet createParagraphElement if it exists!
    return [{ type: "p", children: [{ text: "" }] }];
  }

  /**
   * Convert Slate JSON into a markdown string for persistence
   */
  static stringify(nodes: SlateNode[]): string {
    // todo: For some reason, the Slate text nodes are missing the "type: paragraph" property.
    // Whether that is expected or not, the parser does not seem to handle that, and
    // silently drops them. Manually adjusting with a defensive copy gets the job done for now,
    // but is a hack.
    // todo: extend the slateToString library if that becomes possible
    // https://github.com/inokawa/remark-slate-transformer/issues/31
    // console.log("SlateTransformer.stringify.nodes-argument:", nodes);
    const copiedNodes = JSON.parse(JSON.stringify(nodes));
    // console.log(
    //   "SlateTransformer.stringify.copiedNodes (JSON Stringified):",
    //   JSON.parse(JSON.stringify(copiedNodes))
    // ); // another copy
    copiedNodes.forEach((n: any) => {
      n.type = n.type || "paragraph";
    });
    // console.log("copiedNodes post transform with paragraphs", copiedNodes);
    // console.log(
    //   "SlateTransformer.stringify.slateToString",
    //   slateToString(copiedNodes)
    // );
    return slateToString(copiedNodes);
  }

  static mdastify(nodes: SlateNode[]): any {
    return slateToMdast(nodes);
  }
}

/**
 * Customized Slate nodes add a 'type' property by convention
 */
export interface TypedNode extends SlateElement {
  type: string;
}

/**
 * As defined by blocks/images wrapper
 * todo: move it there?
 */
export interface ImageElement extends TypedNode {
  type: "image";
  url: "string";
  // other properties too, like for label
}

export interface VideoElement extends TypedNode {
  type: "video";
  url: "string";
  // surely other properties too
}

export interface LinkElement extends TypedNode {
  type: "link";
  title: string | null;
  url: string;
}

// Extend slates isElement check to also check that it has a "type" property,
// which all custom elements will have
// https://docs.slatejs.org/concepts/02-nodes#element
export function isTypedElement(node: any): node is TypedNode {
  return SlateElement.isElement(node) && !!(node as any).type;
}

export function isImageElement(node: any): node is ImageElement {
  return isTypedElement(node) && node.type === "image";
}

export function isVideoElement(node: any): node is VideoElement {
  return isTypedElement(node) && node.type === "video";
}

export function isLinkElement(node: any): node is LinkElement {
  return isTypedElement(node) && node.type === "link";
}

/**
 * Print the return value from a slate `Editor.nodes` (or comprable) call
 */
export function printNodes(nodes: any) {
  // Slate's retrieval calls return a generator, and `Array.from` wasn't working
  // Maybe spread syntax?
  let results = [];

  for (const node of nodes) {
    results.push(node);
  }

  console.log(JSON.stringify(results, null, 2));
}
