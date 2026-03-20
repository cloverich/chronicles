import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { $isLinkNode, AutoLinkNode, LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  LINK,
  TRANSFORMERS,
  type ElementTransformer,
  type TextMatchTransformer,
  type Transformer,
} from "@lexical/markdown";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import {
  $createTextNode,
  $findMatchingParent,
  createEditor,
  type Klass,
  type LexicalNode,
  type TextNode,
} from "lexical";
import { prefixUrl, unPrefixUrl } from "../../../hooks/images";
import { parseNoteLink } from "../editorv2/features/note-linking/toMdast";
import {
  $createChroniclesImageNode,
  $isChroniclesImageNode,
  ChroniclesImageNode,
} from "./ChroniclesImageNode";
import {
  $createChroniclesNoteLinkNode,
  $isChroniclesNoteLinkNode,
  ChroniclesNoteLinkNode,
} from "./ChroniclesNoteLinkNode";

const IMAGE_ELEMENT_REGEXP = /^!\[([^[\]]*)\]\(([^()\s]+)\)\s?$/;
const NOTE_LINK_IMPORT_REGEXP =
  /(?:\[([^[\]]*(?:\[[^[\]]*\][^[\]]*)*)\])(?:\((\.\.\/[^()\s]+\.md)(?:\s"((?:[^"]*\\")*[^"]*)"\s*)?\))/;
const NOTE_LINK_SHORTCUT_REGEXP =
  /(?:\[([^[\]]*(?:\[[^[\]]*\][^[\]]*)*)\])(?:\((\.\.\/[^()\s]+\.md)(?:\s"((?:[^"]*\\")*[^"]*)"\s*)?\))$/;
const QUOTED_LINK_URL_REGEXP = /\[([^[\]]+)\]\("([^")\s]+)"\)/g;

function createLinkTextNode(node: TextNode, match: RegExpMatchArray) {
  const [, linkText, url, title] = match;

  if (!$isChroniclesNoteLinkUrl(url)) {
    return;
  }

  const linkNode = $createChroniclesNoteLinkNode(url, { title });
  const openBracketCount = linkText.split("[").length - 1;
  const closeBracketCount = linkText.split("]").length - 1;
  let normalizedText = linkText;
  let leadingText = "";

  if (openBracketCount > closeBracketCount) {
    const fragments = linkText.split("[");
    leadingText = `[${fragments[0]}`;
    normalizedText = fragments.slice(1).join("[");
  }

  const contentNode = $createTextNode(normalizedText);
  contentNode.setFormat(node.getFormat());
  linkNode.append(contentNode);
  node.replace(linkNode);

  if (leadingText) {
    linkNode.insertBefore($createTextNode(leadingText));
  }

  return contentNode;
}

function normalizeImageSource(url: string): string {
  if (url.startsWith("chronicles://")) {
    return url;
  }
  return prefixUrl(url);
}

export const CHRONICLES_IMAGE_TRANSFORMER: ElementTransformer = {
  dependencies: [ChroniclesImageNode],
  export: (node) => {
    if (!$isChroniclesImageNode(node)) {
      return null;
    }

    const altText = node
      .getAltText()
      .replace(/\\/g, "\\\\")
      .replace(/\[/g, "\\[")
      .replace(/\]/g, "\\]");
    const src = unPrefixUrl(node.getSrc()).replace(/\)/g, "%29");
    return `![${altText}](${src})`;
  },
  regExp: IMAGE_ELEMENT_REGEXP,
  replace: (parentNode, _children, match) => {
    const [, altText, src] = match;
    parentNode.replace(
      $createChroniclesImageNode(normalizeImageSource(src), altText),
    );
  },
  type: "element",
};

export const CHRONICLES_NOTE_LINK_TRANSFORMER: TextMatchTransformer = {
  dependencies: [ChroniclesNoteLinkNode],
  export: (node, exportChildren) => {
    if (!$isChroniclesNoteLinkNode(node)) {
      return null;
    }

    const title = node.getTitle();
    const content = exportChildren(node);

    return title
      ? `[${content}](${node.getURL()} "${title}")`
      : `[${content}](${node.getURL()})`;
  },
  importRegExp: NOTE_LINK_IMPORT_REGEXP,
  regExp: NOTE_LINK_SHORTCUT_REGEXP,
  replace: (node, match) => {
    if ($findMatchingParent(node, $isLinkNode)) {
      return;
    }

    return createLinkTextNode(node, match);
  },
  trigger: LINK.trigger,
  type: "text-match",
};

export const lexicalNodes: Array<Klass<LexicalNode>> = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  CodeNode,
  CodeHighlightNode,
  LinkNode,
  AutoLinkNode,
  ChroniclesImageNode,
  ChroniclesNoteLinkNode,
];

export const chroniclesLexicalTransformers: Transformer[] = [
  CHRONICLES_IMAGE_TRANSFORMER,
  CHRONICLES_NOTE_LINK_TRANSFORMER,
  ...TRANSFORMERS,
];

function normalizeQuotedUrlLinks(markdown: string): string {
  return markdown.replace(QUOTED_LINK_URL_REGEXP, "[$1]($2)");
}

export function $loadMarkdownIntoLexical(markdown: string): void {
  $convertFromMarkdownString(
    normalizeQuotedUrlLinks(markdown),
    chroniclesLexicalTransformers,
  );
}

export function $exportMarkdownFromLexical(): string {
  return $convertToMarkdownString(chroniclesLexicalTransformers);
}

export function roundtripLexicalMarkdown(markdown: string): string {
  const editor = createEditor({
    namespace: "chronicles-lexical-test",
    nodes: lexicalNodes,
    onError(error) {
      throw error;
    },
  });

  editor.update(
    () => {
      $loadMarkdownIntoLexical(markdown);
    },
    { discrete: true },
  );

  return editor.read(() => $exportMarkdownFromLexical());
}

export function $isChroniclesNoteLinkUrl(url: string): boolean {
  return parseNoteLink(url) !== null;
}
