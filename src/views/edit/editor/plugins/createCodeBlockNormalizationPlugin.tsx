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
    const { normalizeNode, insertData } = editor;

    editor.normalizeNode = ([node, path]) => {
      if (node.type === ELEMENT_CODE_BLOCK) {
        const blockEntries = Array.from(
          Editor.nodes(editor as Editor, {
            at: path,
            match: (n) => (n as any).type === ELEMENT_CODE_LINE,
          }),
        );

        if (blockEntries.length > 1) {
          const [firstCodeLine, firstCodeLinePath] = blockEntries[0];
          blockEntries.slice(1).forEach(([, codeLinePath]) => {
            Transforms.mergeNodes(editor as Editor, { at: codeLinePath });
          });
          Transforms.setNodes(
            editor as Editor,
            { type: ELEMENT_CODE_BLOCK } as any,
            { at: firstCodeLinePath },
          );
        }
      }
      normalizeNode([node, path]);
    };

    editor.insertData = (data: DataTransfer) => {
      const text = data.getData("text/plain");
      if (
        text &&
        Editor.above(editor as Editor, {
          match: (n: any) => n.type === ELEMENT_CODE_BLOCK,
        })
      ) {
        const lines = text.split("\n");
        const { selection } = editor;
        if (selection && Range.isCollapsed(selection)) {
          Transforms.insertText(editor as Editor, lines.join("\n"), {
            at: selection,
          });
        } else {
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
        return;
      }
      insertData(data);
    };

    return editor;
  },
});
