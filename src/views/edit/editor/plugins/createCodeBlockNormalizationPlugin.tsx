import { createPlatePlugin, PlateEditor } from "@udecode/plate/react";
import { Transforms } from "slate";
import { dedent } from "../../../../dedent.js";
import { ELEMENT_CODE_BLOCK } from "../plate-types";

const isInCodeBlock = (editor: PlateEditor) => {
  const [match] = Array.from(
    (editor as any).nodes({
      match: (n: any) => n.type === ELEMENT_CODE_BLOCK,
    }),
  );
  return !!match;
};

/**
 * This plugin handles pasted code to ensure it is pasted as a single block and indentation
 * is normalized.
 */
export const createCodeBlockNormalizationPlugin = createPlatePlugin({
  key: "createCodeBlockNormalizationPlugin",
}).overrideEditor(({ editor }) => {
  const originalInsertData = editor.insertData;

  editor.insertData = (data: DataTransfer) => {
    let text = data.getData("text/plain");

    // Bail if we aren't pasting text into a code block.
    if (!text || !isInCodeBlock(editor)) {
      (originalInsertData as any)(data);
      return;
    }

    const { selection } = editor;
    if (!selection) return;

    // strip base indentation: common when pasting from an editor
    // note this maintains relative indentation, just not the overall
    // indentation of the block (e.g. copying from a very nested function)
    text = dedent(text.trim());

    Transforms.insertText(editor as any, text, {
      at: selection,
    });
  };

  return editor;
});
