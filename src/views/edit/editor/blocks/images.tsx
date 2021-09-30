import React from 'react';
import { ReactEditor, RenderElementProps } from "slate-react";
import { Transforms } from "slate";
import { ImageElement, VideoElement } from '../../util';
import { css } from 'emotion';

/**
 * Create an image node and insert it at the current selection
 */
function insertImage(editor: ReactEditor, filepath: string) {
  const image = { type: 'image', url: filepath, children: [{ text: '' }] }
  Transforms.insertNodes(editor, image)
  padDocument(editor);
}

function insertVideo(editor: ReactEditor, filepath: string) {
  const image = { type: 'video', url: filepath, children: [{ text: '' }] }
  Transforms.insertNodes(editor, image)
  padDocument(editor);

}

/**
 * Add an extra paragraph node to protect against video or image elements being
 * the last element in the document, which currently prevents user from entering
 * more text. Ideally a listener at a higher level could observe for blocking elements
 * and if the lsat element is not editable text or something, auto-insert a paragraph block.
 */
function padDocument(editor: ReactEditor) {
  Transforms.insertNodes(editor, { type: 'paragraph', children: [{text: ''}]} as any);
}

export function insertFile(editor: ReactEditor, filepath: string) {
  const extension = filepath.split('.').pop();
  if (!extension) {
    console.error('insertFile called but filepath did not contain an extension:', filepath);
    return;
  }

  if (imageExtensions.includes(extension)) {
    return insertImage(editor, filepath)
  }

  if (videoExtensions.includes(extension)) {
    return insertVideo(editor, filepath);
  }

  console.error('Unable to insertFile into Slate Editor of unknown extension: ', filepath);
}


const isFileProtocol = location.protocol.startsWith('file');

/**
 * Conditionally prefix image urls with file:/// depending on how this 
 * renderer process was loaded:
 * 
 * - http: In development, the renderer process is served via webpack over http
 * - file: In production, the packaged app is loaded from the main process as a file
 * 
 * @param url 
 * @returns 
 */
function prefixUrl(url: string) {
  // When you drag and drop an image it's URL is a filepath on the local device
  // To display in the browser, if the app is packaged the page is hosted as a file,
  // meaning <img src="file:///...." />

  // Assume if its not prefixed with http, its just a path to a local file
  const isLocalPath = !url.startsWith('http');

  if (isFileProtocol && isLocalPath) {
    return 'file:///' + url;
  } else {
    // Regular URLs are always ok to use as is
    // Filepaths are ok to use as is when in development mode, 
    // i.e. this app is hosted over http from webpack...
    return url;
  }
}


interface ImageElementProps extends RenderElementProps {
  element: ImageElement;
}

interface VideoElementProps extends RenderElementProps {
  element: VideoElement;
}

export const Image = ({ attributes, children, element }: ImageElementProps) => {
  return (
    <div {...attributes}>
      <div contentEditable={false}>
        <img
          src={prefixUrl(element.url)}
          className={css`
            display: block;
            max-width: 100%;
            max-height: 20em;
          `}
        />
      </div>
      {children}
    </div>
  )
}

export const Video = ({ attributes, children, element }: VideoElementProps) => {
  return (
    <div {...attributes}>
      <div contentEditable={false}>
        <video
          src={prefixUrl(element.url)}
          controls
          className={css`
            display: block;
            max-width: 100%;
            max-height: 20em;
          `}
        />
      </div>
      {children}
    </div>
  )
}

/**
 * Does the URL end with a known image extension?
 */
export function isImageUrl (filepath: string) {
  const extension = filepath.split('.').pop();
  if (!extension) return false;
  return imageExtensions.includes(extension.toLowerCase());
}


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

// https://github.com/sindresorhus/video-extensions/blob/main/video-extensions.json
const videoExtensions = [
	"3g2",
	"3gp",
	"aaf",
	"asf",
	"avchd",
	"avi",
	"drc",
	"flv",
	"m2v",
	"m3u8",
	"m4p",
	"m4v",
	"mkv",
	"mng",
	"mov",
	"mp2",
	"mp4",
	"mpe",
	"mpeg",
	"mpg",
	"mpv",
	"mxf",
	"nsv",
	"ogg",
	"ogv",
	"qt",
	"rm",
	"rmvb",
	"roq",
	"svi",
	"vob",
	"webm",
	"wmv",
	"yuv"
];