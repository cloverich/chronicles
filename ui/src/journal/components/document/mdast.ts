import { Root } from "mdast";
// import { Node, Parent } from "unist";
import { toJS } from "mobx";
import { stringifier } from "../../../markdown/index";
import { SearchRequest } from "../../../client";

interface Filter {
  content: string;
  depth: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

/**
 * A loosely defined mdast Node.
 *
 * Compare with unist.Node, unist.Parent, and mast nodes
 */
interface Node {
  type: string;
  children?: Node[];
  [key: string]: any;
}

/**
 * Filter an MDAST to only those elements "under" a heading.
 *
 * Returns a new tree with elements after the passed heading, stopping
 * at either the end of the tree or another heading of equal or lesser
 * depth, whichever comes first.
 *
 * @param root - A full MDAST tree
 * @param heading - The heading to filter on
 */
export function focusHeading(root: Root, heading: Filter) {
  // Once we've matched a heading element in root, set this
  // variable to its depth (h1 -> 1, h2 -> 2, etc)
  // Used as a trigger to start and stop: When > 0, start.
  // Then, stop when finding another heading >= depth
  let depth = 0;

  // Create a new root to fill with just the content
  // under the focused heading
  const focused = {
    ...root,
    children: [] as any[],
  };

  for (const child of root.children) {
    if (child.type === "heading") {
      // if new heading is >= this heading, stop collecting
      if (depth && depth >= child.depth) {
        return focused;

        // If not yet collecting, should we start?
      } else if (stringifier.stringify(child) === heading.content) {
        depth = child.depth;
        // Don't add the matching heading, just the content under it
        continue;
      }
    }

    // if depth is set, we are collecting nodes
    if (depth > 0) {
      focused.children.push(child);
    }
  }

  // Reached end of tree
  return focused;
}

/**
 * Annotate heading elements with their raw markdwon string.
 *
 * This is an implementation detail of how the mdast tree is rendered, where
 * converting to HAST then HTML loses information about the original mdast tree.
 * When "focusing" a heading, we use an event handler to bubble up the
 * clicked headings original markdown string for searching.
 *
 * This is pretty hacky and not optimal performance wise, but it works.
 *
 * @param root
 */
export function annotateHeadings(root: Root) {
  for (const child of root.children) {
    if (child.type === "heading") {
      if (!child.data) child.data = {};
      child.data.hProperties = {
        // toJS here fixes a read out of bounds mobx error
        remarkString: stringifier.stringify(toJS(child)),
      };
    }
  }
}

/**
 * Filter an mdast tree to contain only nodes matching `filter`
 *
 * @param root
 * @param filter
 */
export function filterMdast(root: Root, filter: SearchRequest["nodeMatch"]) {
  const children: any[] = [];
  root.children.forEach((child) =>
    collectChildren(child as any, filter, children)
  );

  return {
    ...root,
    children,
  };
}

/**
 * Iterate array of child mdast nodes looking for matches
 *
 * @param root
 * @param filter
 * @param children
 */
function collectChildren(
  child: Node,
  filter: SearchRequest["nodeMatch"],
  children: any[]
) {
  // If this node does not match, check each child
  if (child.type !== filter!.type) {
    if (child.children) {
      // A child can have children too, unclear if types are wrong or my
      // usage is.
      child.children.forEach((child: any) =>
        collectChildren(child, filter, children)
      );
    }

    return;
  }

  // Otherwise, include this node (conditionally, if attributes match)
  // ASSUMPTION: A node will never have a child node of same type
  // ex: If at this point we have a Code block, but it has the wrong attributes (like lang)
  // it will not have a child node that does

  // If no attributes, match found
  if (!filter!.attributes) {
    children.push(child);
    return;
  }

  // otherwise, filter on attributes too
  Object.keys(filter!.attributes).forEach((key) => {
    const value = filter!.attributes![key];
    if (key in child && child[key] === value) {
      children.push(child);
    }
  });

  return children;
}
