// https://github.com/inokawa/remark-slate-transformer/
import unified from "unified";
import remarkParse from "remark-parse";
import stringify from "remark-stringify";
import {
  remarkToSlate,
  slateToRemark,
  // mdastToSlate,
} from "remark-slate-transformer";
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
    // Not sure which plugin adds result but its definitely there...
    return (stringToSlate.processSync(text) as any).result;
  }

  /**
   * Create an empty Slate DOM, intended for new empty documents.
   */
  static createEmptyNodes() {
    return [{ children: [{ text: "" }] }];
  }

  static stringify(nodes: SlateNode[]): string {
    const ast = slateToString.runSync({
      type: "root",
      children: nodes,
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
 * As defined by withImages wrapper
 */
export interface ImageElement extends TypedNode {
  type: "image";
  url: "string";
  // other properties too, like for label
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

export function isLinkElement(node: any): node is LinkElement {
  return isTypedElement(node) && node.type === "link";
}

/**
 * Convert Slate DOM to MDAST for visualization.
 * TODO: This probably should be co-located with the ASTViewer
 */
export function slateToMdast(nodes: SlateNode[]) {
  // Wrapping in a root node was done via the example, and seems to work but
  // I have not formalized my understanding of it
  return JSON.stringify(
    slateToString.runSync({
      type: "root",
      children: nodes,
    }),
    null,
    2
  );
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
