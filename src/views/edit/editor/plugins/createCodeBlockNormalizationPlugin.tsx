import { createPluginFactory } from "@udecode/plate-common";
import { Editor, Range, Transforms } from "slate";
import { ELEMENT_CODE_BLOCK, ELEMENT_CODE_LINE } from "@udecode/plate";

/**
 * This plugin handles pasted code to ensure it is pasted as a single block. Prior to this pasting
 * a block of code into the editor would generate a new code_block for each line. This solution
 * was not extensively tested!
 */
export const createCodeBlockNormalizationPlugin = createPluginFactory({
  key: "customPlugin",
  withOverrides: (editor) => {
    // todo: types -- Various methods below do `editor as Editor` because editor here is PlateEditor.
    // Unsure what the right way to cast this is -- Grepped a few examples from Plate's codebase
    // and they do `Editor as any` which seems wrong.
    // Also, `node as any` -- Slate's methods aren't expecting `type` on Node but its foundational
    // to custom elements.
    const { insertData } = editor;

    editor.insertData = (data: DataTransfer) => {
      const text = data.getData("text/plain");
      if (
        !text ||
        !Editor.above(editor as Editor, {
          match: (n: any) => n.type === ELEMENT_CODE_BLOCK,
        })
      ) {
        insertData(data);
        return;
      }

      const lines = text.split("\n");
      const { selection } = editor;
      if (selection && Range.isCollapsed(selection)) {
        // When pasting at cursor (no text / blocks selected), insert as a single block.
        Transforms.insertText(editor as Editor, lines.join("\n"), {
          at: selection,
        });
      } else {
        // Pasting when selecting multiple lines; if its within a code block, it ends up as one block.
        // I think Plates createCodeBlockPlugin (from createBasicPlugins) is normalizing this to a single block...
        // unclear if this code makes sense.
        lines.forEach((line) => {
          Transforms.insertText(editor as Editor, line);
          Transforms.insertNodes(
            editor as Editor,
            {
              type: ELEMENT_CODE_LINE,
              children: [{ text: "" }],
            } as any,
          );
        });
      }

      insertData(data);
    };

    return editor;
  },
});
