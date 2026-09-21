import {
  $applyNodeReplacement,
  DecoratorNode,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
} from "lexical";
import React, { type ReactNode } from "react";
import { parseNoteLink } from "../../../markdown/noteLinks";

interface SerializedTableNode extends SerializedLexicalNode {
  source: string;
  type: "markdown-table";
  version: 1;
}

function cells(row: string): string[] {
  const source = row
    .trim()
    .replace(/^\|/, "")
    .replace(/(?<!\\)\|$/, "");
  const result: string[] = [];
  let cell = "";
  for (let i = 0; i < source.length; i++) {
    if (source[i] === "\\" && source[i + 1] === "|") {
      cell += "|";
      i++;
    } else if (source[i] === "|") {
      result.push(cell.trim());
      cell = "";
    } else {
      cell += source[i];
    }
  }
  result.push(cell.trim());
  return result;
}

function inline(source: string): ReactNode[] {
  const tokens = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^\s)]+\))/g;
  return source.split(tokens).map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={index}>{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*"))
      return <em key={index}>{part.slice(1, -1)}</em>;
    const link = part.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/);
    if (link) {
      const url = link[2];
      if (parseNoteLink(url)) {
        return (
          <a key={index} href={url} data-chronicles-note-link="true">
            {link[1]}
          </a>
        );
      }
      return /^https?:\/\/|^\//.test(url) ? (
        <a key={index} href={url}>
          {link[1]}
        </a>
      ) : (
        part
      );
    }
    return part;
  });
}

export class MarkdownTableNode extends DecoratorNode<ReactNode> {
  __source: string;

  static getType(): string {
    return "markdown-table";
  }
  static clone(node: MarkdownTableNode): MarkdownTableNode {
    return new MarkdownTableNode(node.__source, node.__key);
  }
  static importJSON(
    serialized: SerializedLexicalNode & Record<string, unknown>,
  ): MarkdownTableNode {
    return $createMarkdownTableNode(
      typeof serialized.source === "string" ? serialized.source : "",
    ).updateFromJSON(serialized);
  }
  constructor(source: string, key?: NodeKey) {
    super(key);
    this.__source = source;
  }
  createDOM(): HTMLElement {
    const container = document.createElement("div");
    container.className = "editor-table";
    container.contentEditable = "false";
    return container;
  }
  updateDOM(): false {
    return false;
  }
  decorate(): ReactNode {
    const [head = "", divider = "", ...rows] = this.__source.split("\n");
    const align = cells(divider).map((value) =>
      value.startsWith(":") && value.endsWith(":")
        ? "center"
        : value.endsWith(":")
          ? "right"
          : "left",
    );
    return (
      <table>
        <thead>
          <tr>
            {cells(head).map((value, index) => (
              <th key={index} style={{ textAlign: align[index] }}>
                {inline(value)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {cells(row).map((value, index) => (
                <td key={index} style={{ textAlign: align[index] }}>
                  {inline(value)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  exportJSON(): SerializedTableNode {
    return {
      ...super.exportJSON(),
      source: this.getSource(),
      type: "markdown-table",
      version: 1,
    };
  }
  isInline(): false {
    return false;
  }
  canInsertTextBefore(): false {
    return false;
  }
  canInsertTextAfter(): false {
    return false;
  }
  getSource(): string {
    return this.getLatest().__source;
  }
}

export function $createMarkdownTableNode(source: string): MarkdownTableNode {
  return $applyNodeReplacement(new MarkdownTableNode(source));
}

export function $isMarkdownTableNode(
  node: LexicalNode | null | undefined,
): node is MarkdownTableNode {
  return node instanceof MarkdownTableNode;
}
