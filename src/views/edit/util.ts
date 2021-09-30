// https://github.com/inokawa/remark-slate-transformer/
import unified from "unified";
import remarkParse from "remark-parse";
import stringify from "remark-stringify";
import { remarkToSlate, slateToRemark } from "remark-slate-transformer";
import { Element as SlateElement, Node as SlateNode } from "slate";

export const slateToString = unified().use(slateToRemark).use(stringify);

// Intermediate markdown parser, exported here so I could store the intermediate
// mdast state prior to parsing to Slate DOM for debugging purposes
export const stringToMdast = unified().use(remarkParse);
const stringToSlate = stringToMdast.use(remarkToSlate);

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

    // todo: types
    // note to future self: processSync is the same as
    // `parse`, `run`, then `stringify`
    // Stringifies valued would be available on `.value`, while
    // parsed objects (Slate JSON in this case) is available as
    // `.result` (after calling process)
    return (stringToSlate as any).processSync(text).result;
  }

  /**
   * Create an empty Slate DOM, intended for new empty documents.
   */
  static createEmptyNodes() {
    return [{ children: [{ text: "" }] }];
  }

  /**
   * Convert Slate JSON into a markdown string for persistence
   */
  static stringify(nodes: SlateNode[]): string {
    // todo: For some reason, the Slate text nodes are missing the "type: paragraph" property.
    // Whether that is expected or not, the parser does not seem to handle that, and
    // silently drops them. Manually adjusting with a defensive copy gets the job done for now,
    // but is a hack.
    const copiedNodes = JSON.parse(JSON.stringify(nodes));
    copiedNodes.forEach((n: any) => {
      n.type = n.type || "paragraph";
    });

    // per documentation https://github.com/inokawa/remark-slate-transformer/
    // slate value must be wrapped. Remark's parse expects a string while `run`
    // operates on ASTs
    const ast = slateToString.runSync({
      type: "root",
      children: copiedNodes,
    });

    return slateToString.stringify(ast);
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
