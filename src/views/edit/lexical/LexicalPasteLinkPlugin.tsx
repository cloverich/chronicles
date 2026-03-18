import { TOGGLE_LINK_COMMAND } from "@lexical/link";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  PASTE_COMMAND,
} from "lexical";
import React from "react";

const LINKABLE_PROTOCOLS = new Set([
  "http:",
  "https:",
  "mailto:",
  "chronicles:",
]);

function normalizePastedLink(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes("\n")) {
    return null;
  }

  const candidate =
    trimmed.startsWith("<") && trimmed.endsWith(">")
      ? trimmed.slice(1, -1)
      : trimmed;

  try {
    const parsed = new URL(candidate);
    if (!LINKABLE_PROTOCOLS.has(parsed.protocol)) {
      return null;
    }

    return candidate;
  } catch {
    return null;
  }
}

function getClipboardTextFromPasteEvent(event: unknown): string | null {
  if (
    typeof ClipboardEvent !== "undefined" &&
    event instanceof ClipboardEvent
  ) {
    return event.clipboardData?.getData("text/plain") ?? null;
  }

  const clipboardData = (
    event as {
      clipboardData?: {
        getData?: (type: string) => string;
      };
    } | null
  )?.clipboardData;

  if (typeof clipboardData?.getData !== "function") {
    return null;
  }

  return clipboardData.getData("text/plain");
}

export function LexicalPasteLinkPlugin(): null {
  const [editor] = useLexicalComposerContext();

  React.useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event) => {
        if (!event) {
          return false;
        }

        const selection = $getSelection();
        if (!$isRangeSelection(selection) || selection.isCollapsed()) {
          return false;
        }

        const pastedText = getClipboardTextFromPasteEvent(event);
        const link = pastedText ? normalizePastedLink(pastedText) : null;
        if (!link) {
          return false;
        }

        event.preventDefault();
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, link);
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor]);

  return null;
}
