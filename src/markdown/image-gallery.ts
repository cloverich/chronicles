import mdast from "mdast";
import { prefixUrl, videoExtensions } from "../hooks/images";
import {
  BaseElement,
  toUndefined,
} from "./remark-slate-transformer/transformers/mdast-to-slate";

export const ELEMENT_IMAGE_GALLERY = "imageGalleryElement";

export type ImageMetadata = {
  alt: string;
  url: string; // "../_attachments/03duel8ega71y7iucmf6uv4zg.png"
  title: string;
};

// Slate element type
export interface IImageGalleryElement {
  type: typeof ELEMENT_IMAGE_GALLERY;
  images: ImageMetadata[];
  children: any[];
}

/**
 * Convert a Slate ImageGroupElement to an mdast list of images.
 */
export function createImagesFromImageGallery(
  node: IImageGalleryElement,
  convertNodes: any,
): mdast.Image[] {
  return convertNodes(node.images);
}

export interface SlateImageGallery extends BaseElement {
  type: typeof ELEMENT_IMAGE_GALLERY;
  images: Array<Image | Video>;
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
  const { url, title, alt } = node;
  const extension = (url?.split(".").pop() || "").toLowerCase();

  if (videoExtensions.includes(extension)) {
    return {
      type: "video",
      url: prefixUrl(url),
      title: toUndefined(title),
      alt: toUndefined(alt),
      caption: [{ text: alt || "" }],
      children: [{ text: "" }],
    };
  }

  return {
    type: "img",
    url: prefixUrl(url),
    title: toUndefined(title),
    alt: toUndefined(alt),
    caption: [{ text: alt || "" }],
    children: [{ text: "" }],
  };
}

/**
 * Converts a markdown node to a Slate ImageGallery element.
 */
export function createImageGalleryElement({
  convertNodes,
  node,
  deco,
}: {
  convertNodes: any;
  node: any;
  deco: any;
}): SlateImageGallery {
  return {
    type: ELEMENT_IMAGE_GALLERY,
    images: ((node.images as any[]) || []).map((image) => createImage(image)),
    children: convertNodes(node.children, deco),
    title: "",
  };
}

/**
 * Group consecutive images into an imageGalleryElement in mdast.
 */
export function unwrapAndGroupImagesSlate(tree: mdast.Root): mdast.Root {
  const children: mdast.Content[] = [];
  let imageNodes: mdast.Image[] = [];

  const flushBuffer = () => {
    if (imageNodes.length === 0) return;

    if (imageNodes.length === 1) {
      children.push(imageNodes[0]);
    } else {
      children.push({
        type: ELEMENT_IMAGE_GALLERY,
        images: imageNodes,
        children: [],
      } as any);
    }

    imageNodes = [];
  };

  for (const node of tree.children) {
    if (
      node.type === "paragraph" &&
      node.children.length === 1 &&
      node.children[0].type === "image"
    ) {
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

/**
 * Reverse unwrapAndGroupImagesSlate: wrap images back in paragraphs for standard mdast.
 */
export function wrapImagesForMdast(tree: mdast.Root) {
  tree.children = tree.children.map((node) => {
    if (node.type === "image") {
      return {
        type: "paragraph",
        children: [node],
      } as mdast.Content;
    }
    return node;
  });

  return tree;
}
