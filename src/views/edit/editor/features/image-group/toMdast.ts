import mdast from "mdast";
import { BaseElement } from "../../../../../markdown/remark-slate-transformer/transformers/mdast-to-slate";
import { ELEMENT_IMAGE_GROUP, IImageGroupElement } from "./ImageGroupElement";

export function createImagesFromImageGroup(
  node: IImageGroupElement,
  convertNodes: any,
): mdast.Image[] {
  return convertNodes(node.children);
}

interface ImageGroupNode extends mdast.Parent {
  /**
   * Node type of mdast paragraph.
   */
  type: "imageGroupElement";
  /**
   * Children of paragraph.
   */
  children: mdast.PhrasingContent[];
  /**
   * Data associated with the mdast paragraph.
   */
  data?: any;
}

interface ToSlateImageGroup {
  convertNodes: any;
  deco: any;
  node: ImageGroupNode;
}

export interface SlateImageGroup extends BaseElement {
  type: "imageGroupElement";
  title: string;
}

/**
 * Converts a markdown link to a NoteLink, if it points to a markdown file.
 */
export function createImageGroupElement({
  convertNodes,
  node,
  deco,
}: ToSlateImageGroup): SlateImageGroup {
  return {
    type: ELEMENT_IMAGE_GROUP,
    children: convertNodes(node.children, deco),
    title: "",
  };
}
