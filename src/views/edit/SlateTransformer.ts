import { Element as SlateElement, Node as SlateNode } from "slate";
import { stringToSlate, slateToString, slateToMdast } from "../../markdown";

/**
 * Helper to convert markdown text into Slate nodes, and vice versa
 *
 * todo(refactor): I think this can be fully incorporated into remark-slate-transformer
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
    // todo: move into forked library (remark-slate-transformer)?
    // Original issue:
    // https://github.com/inokawa/remark-slate-transformer/issues/31
    const copiedNodes = JSON.parse(JSON.stringify(nodes));

    copiedNodes.forEach((n: any) => {
      n.type = n.type || "paragraph";
    });
    return slateToString(copiedNodes);
  }

  static mdastify(nodes: SlateNode[]): any {
    return slateToMdast(nodes);
  }
}
