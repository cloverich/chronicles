import { Plugin, Transformer } from "unified";
import { Root, Node, Parent } from ".";
// https://github.com/syntax-tree/unist-util-map
import { map } from "unist-util-map";

type Settings = {};

/**
 * After slate->mdast parsing, image elements on their own lie get wrapped in paragraph
 * elements. This (unist) plugin can unwrap them prior to the final mdast->slate step.
 *
 * todo: Does this conceptually duplicate Slate's unwrap helper(s)?
 * todo: Could this be better integrated into the existing mdast->slate handler?
 */
export const unnestImages: Plugin<[Settings?]> = (settings?: Settings) => {
  const mapNodes: Transformer = (tree: Node) => {
    return map(tree, (node: any) => {
      if (node.type === "paragraph" && node.children) {
        if (
          node.children[0] &&
          node.children[0].type === "image" &&
          node.children.length === 1
        ) {
          return node.children[0];
        } else {
          return node;
        }
      } else {
        return node;
      }
    });
  };

  return mapNodes;
};
