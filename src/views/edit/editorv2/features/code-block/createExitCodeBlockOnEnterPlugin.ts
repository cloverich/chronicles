import { createPlatePlugin } from "platejs/react";
import { Path } from "slate";
import { ELEMENT_PARAGRAPH } from "../../../plate-types";

/**
 * Allows Enter (without Shift) to exit code block and create a paragraph
 * element below, rather than creating a new code block.
 *
 * todo: This behavior is likely configurable within plate or the code block plugin, without
 * this custom plugin.
 */
export const exitCodeBlockOnEnterPlugin = createPlatePlugin({
  key: "exitCodeBlockOnEnter",
  handlers: {
    onKeyDown: ({ editor, event }) => {
      if (event.key !== "Enter" || event.shiftKey) return;

      const entry = editor.api.above({ match: { type: "code_block" } });
      if (!entry) return;

      event.preventDefault();

      const [, path] = entry;
      const nextPath = Path.next(path);
      editor.tf.insertNodes(
        { type: ELEMENT_PARAGRAPH, children: [{ text: "" }] },
        { at: nextPath },
      );
      editor.tf.select(nextPath);
      editor.tf.focus();
      return true;
    },
  },
});
