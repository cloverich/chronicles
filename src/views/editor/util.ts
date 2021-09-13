// https://github.com/inokawa/remark-slate-transformer/
import unified from "unified";
import markdown from "remark-parse";
import stringify from "remark-stringify";
import {
  remarkToSlate,
  slateToRemark,
  // mdastToSlate,
} from "remark-slate-transformer";
import { Element as SlateElement, Node as SlateNode } from "slate";

export const slateToString = unified().use(slateToRemark).use(stringify);
const stringToSlate = unified().use(markdown).use(remarkToSlate);
// export const slateToMdast = unified().use(slateToRemark);

/**
 * Helper to convert markdown text into Slate nodes, and vice versa
 */
export class SlateTransformer {
  static nodify(text: string): SlateNode[] {
    // Not sure which plugin adds result but its definitely there...
    return (stringToSlate.processSync(text) as any).result;
  }

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

// Extend slates isElement check to also check that it has a "type" property,
// which all custom elements will have
// https://docs.slatejs.org/concepts/02-nodes#element
export function isTypedElement(node: any): node is TypedNode {
  return SlateElement.isElement(node) && !!(node as any).type;
}

export function isImageElement(node: any): node is ImageElement {
  return isTypedElement(node) && node.type === "image";
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
