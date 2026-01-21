import { createPlatePlugin } from "platejs/react";
import { Editor, Transforms } from "slate";

export const NOTE_LINK = "noteLinkingPlugin";

const TRIGGER = "@";
const TRIGGER_PRIOR_PATTERN = /^\s?$/; // whitespace or beginning of line

/**
 * Insert a note linking dropdown when "@" is typed.
 *
 * This plugin handles detecting the "@" character, inserting the dropdown,
 * and injecting the search store into the dropdown.
 */
export const createNoteLinkDropdownPlugin = createPlatePlugin({
  key: NOTE_LINK,
  node: {
    isVoid: true,
    isInline: true,
    isElement: true,
  },
  rules: {
    selection: { affinity: "directional" },
  },
  handlers: {
    onKeyDown: ({ editor, event }) => {
      // Only handle @ key
      if (event.key !== "@" && !(event.shiftKey && event.key === "2")) {
        return;
      }

      // Check if we're about to type @
      const willType = event.shiftKey && event.key === "2" ? "@" : event.key;
      if (willType !== "@") {
        return;
      }

      if (!editor.selection) {
        return;
      }

      // Check the previous character
      const pointBefore = Editor.before(editor as any, editor.selection);
      const range = pointBefore
        ? Editor.range(editor as any, editor.selection, pointBefore)
        : null;
      const previousChar = range ? Editor.string(editor as any, range) : "";

      if (TRIGGER_PRIOR_PATTERN?.test(previousChar)) {
        event.preventDefault();

        Transforms.insertNodes(
          editor as any,
          {
            type: NOTE_LINK,
            trigger: TRIGGER,
            children: [{ text: "" }],
          } as any,
        );

        return true;
      }
    },
  },
});
