import { createPlatePlugin } from "platejs/react";
import { dedent } from "../../../../../dedent.js";
import { ELEMENT_CODE_BLOCK } from "../../../plate-types";

const isInCodeBlock = (editor: any) =>
  editor.api.some({
    match: { type: ELEMENT_CODE_BLOCK },
  });

/**
 * Normalize pasted text inside code blocks by stripping shared indentation.
 */
export const createCodeBlockNormalizationPlugin = createPlatePlugin({
  key: "codeBlockNormalizationPlugin",
  parser: {
    format: "text/plain",
    transformData: ({ data, editor }) => {
      if (!data || !isInCodeBlock(editor)) return data;

      const normalized = dedent(data.trim());
      return normalized || data;
    },
  },
  handlers: {
    onPaste: ({ editor, event }) => {
      const text = event.clipboardData?.getData("text/plain");
      if (!text || !isInCodeBlock(editor)) return;

      event.preventDefault();
      const normalized = dedent(text.trim());
      if (!normalized) return true;

      editor.tf.insertText(normalized);
      return true;
    },
  },
});
