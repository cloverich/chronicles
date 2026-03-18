import {
  LinkNode,
  type LinkAttributes,
  type SerializedLinkNode,
} from "@lexical/link";
import {
  $applyNodeReplacement,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
} from "lexical";

const NOTE_LINK_CLASSES = [
  "text-link",
  "hover:text-link-hover",
  "cursor-pointer",
  "underline",
  "decoration-1",
  "underline-offset-1",
] as const;

export class ChroniclesNoteLinkNode extends LinkNode {
  static getType(): string {
    return "chronicles-note-link";
  }

  static clone(node: ChroniclesNoteLinkNode): ChroniclesNoteLinkNode {
    return new ChroniclesNoteLinkNode(
      node.__url,
      {
        rel: node.__rel,
        target: node.__target,
        title: node.__title,
      },
      node.__key,
    );
  }

  static importJSON(
    serializedNode: SerializedLinkNode,
  ): ChroniclesNoteLinkNode {
    return $createChroniclesNoteLinkNode(serializedNode.url, {
      rel: serializedNode.rel ?? null,
      target: serializedNode.target ?? null,
      title: serializedNode.title ?? null,
    }).updateFromJSON(serializedNode);
  }

  constructor(url: string, attributes?: LinkAttributes, key?: NodeKey) {
    super(url, attributes, key);
  }

  createDOM(config: EditorConfig): HTMLAnchorElement | HTMLSpanElement {
    const anchor = super.createDOM(config);

    anchor.dataset.chroniclesNoteLink = "true";
    anchor.classList.add(...NOTE_LINK_CLASSES);

    return anchor;
  }

  updateDOM(
    prevNode: this,
    anchor: HTMLAnchorElement | HTMLSpanElement,
    config: EditorConfig,
  ): boolean {
    const updated = super.updateDOM(prevNode, anchor, config);

    anchor.dataset.chroniclesNoteLink = "true";
    anchor.classList.add(...NOTE_LINK_CLASSES);

    return updated;
  }

  exportJSON(): SerializedLinkNode {
    return {
      ...super.exportJSON(),
      type: ChroniclesNoteLinkNode.getType(),
    };
  }
}

export function $createChroniclesNoteLinkNode(
  url: string,
  attributes?: LinkAttributes,
): ChroniclesNoteLinkNode {
  return $applyNodeReplacement(
    new ChroniclesNoteLinkNode(url, attributes),
  ) as ChroniclesNoteLinkNode;
}

export function $isChroniclesNoteLinkNode(
  node: LexicalNode | null | undefined,
): node is ChroniclesNoteLinkNode {
  return node instanceof ChroniclesNoteLinkNode;
}
