import type * as mdast from "mdast";
import { parseMarkdown } from "./index";

export type UrlNode = mdast.Link | mdast.Image | mdast.Definition;

/**
 * Rewrite link, image, and definition destinations in place, preserving every
 * other byte of the source. `fn` returns the replacement URL, or undefined to
 * leave a node unchanged. Code spans and fences never yield URL nodes, so
 * their contents are never touched.
 *
 * Replacement values are written verbatim; callers must only produce
 * destinations that are valid unescaped in CommonMark (no spaces or parens).
 */
export function rewriteUrls(
  markdown: string,
  fn: (url: string, node: UrlNode) => string | undefined,
): { markdown: string; unmatched: string[] } {
  const tree = parseMarkdown(markdown);
  const edits: { start: number; end: number; text: string }[] = [];
  const unmatched: string[] = [];

  const visit = (node: mdast.Node) => {
    if (
      node.type === "link" ||
      node.type === "image" ||
      node.type === "definition"
    ) {
      const urlNode = node as UrlNode;
      const replacement = fn(urlNode.url, urlNode);
      if (replacement !== undefined && replacement !== urlNode.url) {
        const edit = locateDestination(markdown, urlNode);
        if (edit) {
          edits.push({ ...edit, text: replacement });
        } else {
          unmatched.push(urlNode.url);
        }
      }
    }
    if ("children" in node) {
      for (const child of (node as mdast.Parent).children) visit(child);
    }
  };
  visit(tree);

  edits.sort((a, b) => b.start - a.start);
  let out = markdown;
  for (const e of edits) {
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  }
  return { markdown: out, unmatched };
}

/**
 * Find the raw destination of a URL node within its source span. The
 * destination follows the link text, so search backward from the node's end
 * for the URL as written (verbatim or percent-encoded). Angle brackets, if
 * any, stay in place around the replacement.
 */
function locateDestination(
  source: string,
  node: UrlNode,
): { start: number; end: number } | null {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (start == null || end == null) return null;
  const span = source.slice(start, end);

  const candidates = [node.url];
  try {
    const encoded = encodeURI(node.url);
    if (encoded !== node.url) candidates.push(encoded);
  } catch {
    // lone surrogate — no encoded form
  }

  let best: { start: number; end: number } | null = null;
  for (const c of candidates) {
    if (!c) continue;
    const i = span.lastIndexOf(c);
    if (i !== -1 && (!best || start + i > best.start)) {
      best = { start: start + i, end: start + i + c.length };
    }
  }
  return best;
}
