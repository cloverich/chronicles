import { Root } from "mdast";
import { toJS } from "mobx";
import { stringifier } from "../../../markdown/index";

interface Filter {
  content: string;
  depth: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
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
