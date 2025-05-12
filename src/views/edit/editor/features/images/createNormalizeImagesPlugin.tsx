import { PlatePlugin } from "@udecode/plate-core";
import { ELEMENT_IMAGE } from "@udecode/plate-media";
import { isElement } from "@udecode/slate";
import { Editor, Transforms } from "slate";
import { ELEMENT_VIDEO } from "../../plugins/createVideoPlugin";

/**
 * Ensure a dropped image is always at the top level of the document.
 *
 * @returns
 */
export const createNormalizeImagesPlugin = (): PlatePlugin => ({
  key: "top-level-image-normalizer",
  withOverrides: (editor) => {
    const { normalizeNode } = editor;

    editor.normalizeNode = ([node, path]) => {
      // NOTE: As of now Chronicles only supports images as top-level elements, or as part of ImageGroupElements,
      // not as children of others. I don't yet understand enough Slate / Plate to grasp the idiomatic approach here,
      // this is my best guess a a solution, after discovering that dropping an image onto a node with a list
      // would either rash the editor (earlier versions) or delete the image and the list item (as of writing).
      if (
        isElement(node) &&
        [ELEMENT_IMAGE, ELEMENT_VIDEO].includes(node.type) &&
        path.length > 1
      ) {
        if (node.type === ELEMENT_VIDEO) {
          console.log("node normalization for video", node, path);
        }
        // Move to root
        Transforms.removeNodes(editor as Editor, { at: path });
        Transforms.insertNodes(editor as Editor, node, {
          at: [editor.children.length],
        });
        return;
      }

      normalizeNode([node, path]);
    };

    return editor;
  },
});
