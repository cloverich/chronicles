

import { Transforms, Node as SlateNode, createEditor, Descendant, Editor, Element as SlateElement } from 'slate'
import { ReactEditor } from 'slate-react';

// todo: centralize these utilities
import unified from "unified";
import markdown from "remark-parse";
import remarkGfm from 'remark-gfm'
import { remarkToSlate, slateToRemark, mdastToSlate } from "remark-slate-transformer";
const parser = unified().use(markdown).use(remarkGfm as any)
import { isTypedElement } from './util';


export const withImages = (editor: ReactEditor) => {
  const { insertData, isVoid, insertBreak, normalizeNode } = editor
 
  // If the element is an image type, make it non-editable
  // https://docs.slatejs.org/concepts/02-nodes#voids
  editor.isVoid = element => {
    // type is a custom property
    return (element as any).type === 'image' ? true : isVoid(element)
  }

  // pasted data
  editor.insertData = (data: DataTransfer) => {
    const text = data.getData('text/plain');
    const { files } = data

    // todo: This is copy pasta from their official examples
    // Implement it for real, once image uploading is decided upon
    if (files && files.length > 0) {
      for (const file of files) {
        const reader = new FileReader()
        const [mime] = file.type.split('/')

        if (mime === 'image') {
          reader.addEventListener('load', () => {
            const url = reader.result
            // insertImage(editor, url);
          })

          reader.readAsDataURL(file)
        }
      }
    } else {
      // NOTE: Calling this for all pasted data is quite experimental
      // and will need to change.
      convertAndInsert(editor, text)
    }
  }

  // Originally added to fix the case where an a mix of markdown image and text is copied,
  // but because of markdown rules that require multiple newlines between paragraphs, 
  // slate was gobbling up images or text depending on the order
  // todo: add test cases
  // https://docs.slatejs.org/concepts/11-normalizing
  editor.normalizeNode = entry => {
    const [node, path] = entry;

    // If the element is a paragraph, ensure its children are valid.
    if (isTypedElement(node) && node.type === 'paragraph') {
      for (const [child, childPath] of SlateNode.children(editor, path)) {
        if (SlateElement.isElement(child) && !editor.isInline(child)) {
          Transforms.unwrapNodes(editor, { at: childPath })
          return
        }
      }
    }
    
    // Fall back to the original `normalizeNode` to enforce other constraints.
    normalizeNode(entry)
  }

  return editor
}

// const insertImage = (editor, url) => {
//   const text = { text: '' }
//   const image: ImageElement = { type: 'image', url, children: [text] }
//   Transforms.insertNodes(editor, image)
// }

function isImageUrl(url: string) {
  if (!url) return false;

  const mdast = parser.parse(url)
  console.log(mdast);
  console.log(mdastToSlate(mdast as any)) // expects Root, parser returns "Node" (its actually a root in my case)
}

function convertAndInsert(editor: ReactEditor, text: string) {
  const mdast = parser.parse(text);
  const slateNodes = mdastToSlate(mdast as any)
  console.log(mdast)
  // const nodes: SlateNode[] = (slateNodes[0] as any).children;
  console.log(slateNodes)

  // nodes.forEach(node => {
  //   Transforms.insertNodes(editor, node)
  // })

  Transforms.insertNodes(editor, slateNodes);
}

// const isImageUrl = url => {
//   if (!url) return false
//   if (!isUrl(url)) return false
//   const ext = new URL(url).pathname.split('.').pop()
//   return imageExtensions.includes(ext)
// }
// https://cdn.shopify.com/s/files/1/3106/5828/products/IMG_9385_1024x1024@2x.jpg?v=1577795595
// const imageExtensionRegex =

// Copied from this repo: https://github.com/arthurvr/image-extensions
// Which is an npm package that is just a json file 
const imageExtensions = [
	"ase",
	"art",
	"bmp",
	"blp",
	"cd5",
	"cit",
	"cpt",
	"cr2",
	"cut",
	"dds",
	"dib",
	"djvu",
	"egt",
	"exif",
	"gif",
	"gpl",
	"grf",
	"icns",
	"ico",
	"iff",
	"jng",
	"jpeg",
	"jpg",
	"jfif",
	"jp2",
	"jps",
	"lbm",
	"max",
	"miff",
	"mng",
	"msp",
	"nitf",
	"ota",
	"pbm",
	"pc1",
	"pc2",
	"pc3",
	"pcf",
	"pcx",
	"pdn",
	"pgm",
	"PI1",
	"PI2",
	"PI3",
	"pict",
	"pct",
	"pnm",
	"pns",
	"ppm",
	"psb",
	"psd",
	"pdd",
	"psp",
	"px",
	"pxm",
	"pxr",
	"qfx",
	"raw",
	"rle",
	"sct",
	"sgi",
	"rgb",
	"int",
	"bw",
	"tga",
	"tiff",
	"tif",
	"vtf",
	"xbm",
	"xcf",
	"xpm",
	"3dv",
	"amf",
	"ai",
	"awg",
	"cgm",
	"cdr",
	"cmx",
	"dxf",
	"e2d",
	"egt",
	"eps",
	"fs",
	"gbr",
	"odg",
	"svg",
	"stl",
	"vrml",
	"x3d",
	"sxd",
	"v2d",
	"vnd",
	"wmf",
	"emf",
	"art",
	"xar",
	"png",
	"webp",
	"jxr",
	"hdp",
	"wdp",
	"cur",
	"ecw",
	"iff",
	"lbm",
	"liff",
	"nrrd",
	"pam",
	"pcx",
	"pgf",
	"sgi",
	"rgb",
	"rgba",
	"bw",
	"int",
	"inta",
	"sid",
	"ras",
	"sun",
	"tga"
]