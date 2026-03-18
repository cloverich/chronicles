import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  COMMAND_PRIORITY_HIGH,
  FORMAT_TEXT_COMMAND,
  KEY_DOWN_COMMAND,
} from "lexical";
import React from "react";

/**
 * Explicitly handles editor text-format shortcuts for deterministic behavior
 * across hosts and tests. We intercept with high priority and dispatch the
 * corresponding Lexical format command.
 */
export function LexicalFormattingShortcutsPlugin(): null {
  const [editor] = useLexicalComposerContext();

  React.useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event) => {
        if (!event) {
          return false;
        }

        const isModifierPressed = event.metaKey || event.ctrlKey;
        if (!isModifierPressed || event.altKey || event.shiftKey) {
          return false;
        }

        const key = event.key.toLowerCase();
        if (key === "b") {
          event.preventDefault();
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold");
          return true;
        }

        if (key === "i") {
          event.preventDefault();
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic");
          return true;
        }

        return false;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor]);

  return null;
}
