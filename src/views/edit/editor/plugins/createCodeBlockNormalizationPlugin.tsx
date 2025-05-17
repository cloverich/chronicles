import { ELEMENT_CODE_BLOCK } from "@udecode/plate";
import { createPluginFactory, PlateEditor } from "@udecode/plate-common";
import { Editor, Transforms } from "slate";
import { dedent } from "../../../../dedent.js";

const isInCodeBlock = (editor: PlateEditor) => {
  return Editor.above(editor as Editor, {
    match: (n: any) => n.type === ELEMENT_CODE_BLOCK,
  });
};

/**
 * This plugin handles pasted code to ensure it is pasted as a single block and indentation
 * is normalized.
 */
export const createCodeBlockNormalizationPlugin = createPluginFactory({
  key: "createCodeBlockNormalizationPlugin",
  withOverrides: (editor) => {
    // todo: types -- Various methods below do `editor as Editor` because editor here is PlateEditor.
    // Unsure what the right way to cast this is -- Grepped a few examples from Plate's codebase
    // and they do `Editor as any` which seems wrong.
    // Also, `node as any` -- Slate's methods aren't expecting `type` on Node but its foundational
    // to custom elements.
    const { insertData } = editor;

    editor.insertData = (data: DataTransfer) => {
      let text = data.getData("text/plain");

      // Bail if we aren't pasting text into a code block.
      if (!text || !isInCodeBlock(editor)) {
        insertData(data);
        return;
      }

      const { selection } = editor;
      if (!selection) return;

      // strip base indentation: common when pasting from an editor
      // note this maintains relative indentation, just not the overall
      // indentation of the block (e.g. copying from a very nested function)
      text = dedent(text.trim());

      Transforms.insertText(editor as Editor, text, {
        at: selection,
      });
    };

    return editor;
  },
});
