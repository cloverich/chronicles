import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  COMMAND_PRIORITY_HIGH,
  FORMAT_TEXT_COMMAND,
  KEY_DOWN_COMMAND,
} from "lexical";
import React from "react";

// On Apple platforms the format modifier is Cmd; Ctrl is reserved for
// emacs-style cursor movement (Ctrl+A start of line, Ctrl+E end of line),
// so we must NOT intercept it. Elsewhere (e.g. a future web build on
// Windows/Linux) Ctrl is the format modifier.
const IS_APPLE =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform);

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

        // Require the platform modifier: Cmd on Apple, Ctrl elsewhere. Using
        // Ctrl on macOS would clobber native cursor movement (e.g. Ctrl+E).
        const isModifierPressed = IS_APPLE ? event.metaKey : event.ctrlKey;
        if (!isModifierPressed || event.altKey) {
          return false;
        }

        const key = event.key.toLowerCase();
        if (!event.shiftKey && key === "b") {
          event.preventDefault();
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold");
          return true;
        }

        if (!event.shiftKey && key === "i") {
          event.preventDefault();
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic");
          return true;
        }

        if (!event.shiftKey && key === "e") {
          event.preventDefault();
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code");
          return true;
        }

        if (!event.shiftKey && key === "u") {
          event.preventDefault();
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline");
          return true;
        }

        if (event.shiftKey && key === "s") {
          event.preventDefault();
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough");
          return true;
        }

        return false;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor]);

  return null;
}
