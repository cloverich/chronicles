import mdast from "mdast";
import { prefixUrl, videoExtensions } from "../../../../../hooks/images";
import {
  BaseElement,
  toUndefined,
} from "../../../../../markdown/remark-slate-transformer/transformers/mdast-to-slate";
import {
  ELEMENT_IMAGE_GALLERY,
  IImageGalleryElement,
} from "./ImageGalleryElement";

/**
 * Convert a Slate ImageGroupElement to an mdast list of images.
 *
 * This is necessary because image group is not a valid mdast node type,
 * so we need to convert it to a list of images instead.
 */
export function createImagesFromImageGallery(
  node: IImageGalleryElement,
  convertNodes: any,
): mdast.Image[] {
  return convertNodes(node.images);
}

interface ImageGalleryNode extends mdast.Parent {
  /**
   * Node type of mdast paragraph.
   */
  type: typeof ELEMENT_IMAGE_GALLERY;
  /**
   * Children of paragraph.
   */
  children: mdast.PhrasingContent[];
  /**
   * Data associated with the mdast paragraph.
   */
  data?: any;
}

interface ToSlateImageGallery {
  convertNodes: any;
  deco: any;
  node: ImageGalleryNode;
}

export interface SlateImageGallery extends BaseElement {
  type: typeof ELEMENT_IMAGE_GALLERY;
  // todo: Video only b/c mdast -> slate conversion dynamically chooses type; normalizing in Slate
  // or when saving mdast might better avoid the need to check. Or could have user simply fix when
  // media is a video. Or just allow it?
  images: Array<Image | Video>;
}

// Needed because we augment mdast with the new imageGroupElement; see below. Note
// this is the _documented_ way to extend mdast types.
declare module "mdast" {
  interface ImageGalleryElement extends Literal {
    type: typeof ELEMENT_IMAGE_GALLERY;
    children: Image[];
  }

  interface RootContentMap {
    imageGroupElement: ImageGalleryElement;
  }
}

// The unwrap code below now handles both unwrapping images (legacy issue), and
// converting consecutive images to image group elements. Ideally the imageGroupElement
// concept exists in our custom slate dom and not mdast but its easiest to put it into
// mdast for now, b/c of how the parsing is architected. Also, this module extension,
// parsing, etc, should be moved to features/image-grouping or something.
export function unwrapAndGroupImagesSlate(tree: mdast.Root): mdast.Root {
  const children: mdast.Content[] = [];
  let imageNodes: mdast.Image[] = [];

  const flushBuffer = () => {
    if (imageNodes.length === 0) return;

    if (imageNodes.length === 1) {
      children.push(imageNodes[0]);
    } else {
      // todo: update type to have .images in place of .children
      // todo: normalize to ensure all are images...
      children.push({
        type: ELEMENT_IMAGE_GALLERY,
        images: imageNodes,
        children: [],
      } as any); // todo: extend mdast types to avoid cast as any
    }

    imageNodes = [];
  };

  for (const node of tree.children) {
    if (
      node.type === "paragraph" &&
      node.children.length === 1 &&
      node.children[0].type === "image"
    ) {
      // unwrap image nodes.
      // stand-alone images are parsed as paragraphs with a single image child; this
      // converts them to just the image node because in Slate rendering we don't want
      // imges to be children of paragraphs. This process must be reversed when going
      // back to mdast; see wrapImagesForMdast below.
      imageNodes.push(node.children[0] as mdast.Image);
    } else {
      flushBuffer();
      children.push(node);
    }
  }

  flushBuffer();
  tree.children = children;
  return tree;
}

// reverse unwrapImages from above
// todo: this was written prior to the micromark, still necessary?
// todo: Is this code stripping relevant positioning information?
export function wrapImagesForMdast(tree: mdast.Root) {
  tree.children = tree.children.map((node) => {
    if (node.type === "image") {
      return {
        type: "paragraph",
        children: [node],
      };
    }
    return node;
  });

  return tree;
}

/**
 * Converts a markdown link to a NoteLink, if it points to a markdown file.
 */
export function createImageGalleryElement({
  convertNodes,
  node,
  deco,
}: ToSlateImageGallery): SlateImageGallery {
  return {
    type: ELEMENT_IMAGE_GALLERY,
    images: ((node.images as any[]) || []).map((image) => createImage(image)),
    children: convertNodes(node.children, deco),
    title: "",
  };
}

export type Image = {
  type: "img";
  url: string;
  title?: string;
  alt?: string;
  caption?: [{ text: string }];
  children: [{ text: "" }];
};

export interface Video extends BaseElement {
  type: "video";
  url: string;
  title?: string;
  alt?: string;
  caption?: [{ text: string }];
  children: [{ text: "" }];
}

/**
 * Handle image AND video nodes
 */
export function createImage(node: mdast.Image): Image | Video {
  const { type, url, title, alt } = node;

  // In slate-to-mdast, we encode video nodes as images, and rely on
  // the file extension here to determine if it's a video or not
  const extension = (url?.split(".").pop() || "").toLowerCase();
  if (videoExtensions.includes(extension)) {
    return {
      type: "video",
      url: prefixUrl(url),
      title: toUndefined(title),
      alt: toUndefined(alt),
      // NOTE: Plate uses "caption" for alt (createCaptionPlugin + CaptionElement)
      caption: [{ text: alt || "" }],
      children: [{ text: "" }],
    };
  }

  return {
    // NOTE: I changed this from simply type, which forwarded the incoming "image" type,
    // to "img", which plate expects
    type: "img",
    // NOTE: I modify url's here which is a bit silly but i'm in hack-it-in mode so :|
    url: prefixUrl(url),
    title: toUndefined(title),
    alt: toUndefined(alt),
    // NOTE: Plate uses "caption" for alt (createCaptionPlugin + CaptionElement)
    caption: [{ text: alt || "" }],
    // NOTE: All slate nodes need text children
    children: [{ text: "" }],
  };
}
