import {
  $applyNodeReplacement,
  DecoratorNode,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
} from "lexical";
import React from "react";

export interface SerializedChroniclesImageNode extends SerializedLexicalNode {
  altText: string;
  src: string;
  type: "chronicles-image";
  version: 1;
}

export class ChroniclesImageNode extends DecoratorNode<JSX.Element> {
  __src: string;
  __altText: string;

  static getType(): string {
    return "chronicles-image";
  }

  static clone(node: ChroniclesImageNode): ChroniclesImageNode {
    return new ChroniclesImageNode(node.__src, node.__altText, node.__key);
  }

  static importJSON(
    serializedNode: SerializedChroniclesImageNode,
  ): ChroniclesImageNode {
    return $createChroniclesImageNode(
      serializedNode.src,
      serializedNode.altText,
    ).updateFromJSON(serializedNode);
  }

  constructor(src: string, altText = "", key?: NodeKey) {
    super(key);
    this.__src = src;
    this.__altText = altText;
  }

  createDOM(): HTMLElement {
    const container = document.createElement("div");
    container.className = "mb-3";
    return container;
  }

  updateDOM(): false {
    return false;
  }

  decorate(): JSX.Element {
    return (
      <img
        src={this.__src}
        alt={this.__altText}
        className="max-h-[320px] max-w-[80%] rounded-md object-contain"
      />
    );
  }

  exportJSON(): SerializedChroniclesImageNode {
    return {
      ...super.exportJSON(),
      altText: this.getAltText(),
      src: this.getSrc(),
      type: "chronicles-image",
      version: 1,
    };
  }

  isInline(): false {
    return false;
  }

  canInsertTextAfter(): false {
    return false;
  }

  canInsertTextBefore(): false {
    return false;
  }

  getSrc(): string {
    return this.getLatest().__src;
  }

  getAltText(): string {
    return this.getLatest().__altText;
  }

  setSrc(src: string): void {
    const writable = this.getWritable();
    writable.__src = src;
  }

  setAltText(altText: string): void {
    const writable = this.getWritable();
    writable.__altText = altText;
  }
}

export function $createChroniclesImageNode(
  src: string,
  altText = "",
): ChroniclesImageNode {
  return $applyNodeReplacement(
    new ChroniclesImageNode(src, altText),
  ) as ChroniclesImageNode;
}

export function $isChroniclesImageNode(
  node: LexicalNode | null | undefined,
): node is ChroniclesImageNode {
  return node instanceof ChroniclesImageNode;
}
