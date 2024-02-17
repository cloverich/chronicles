/**
 * For absolute image urls, prefix them with chronicles:// which will trigger
 * the protocol handler in the main process, which as of now merely serves
 * the file
 *
 *
 * @param url
 * @returns
 */
export function prefixUrl(url: string) {
  const isLocalPath = !url.startsWith("http");

  if (isLocalPath) {
    // note: Originally added while testing; If a data url is intentional
    // I guess this is needed to support it, so leaving it in (untested).
    if (url.startsWith("data:")) {
      return url;
    }

    return "chronicles://" + url;
  } else {
    return url;
  }
}

export function unPrefixUrl(url: string) {
  if (url.startsWith("chronicles://")) {
    return url.slice(13);
  } else {
    return url;
  }
}

/**
 * Does the URL end with a known image extension?
 */
export function isImageUrl(filepath: string) {
  const extension = filepath.split(".").pop();
  if (!extension) return false;
  return imageExtensions.includes(extension.toLowerCase());
}

/**
 * Does the URL end with a known video extension?
 */
export function isVideoUrl(filepath: string) {
  const extension = filepath.split(".").pop();
  if (!extension) return false;
  return videoExtensions.includes(extension.toLowerCase());
}

// Copied from this repo: https://github.com/arthurvr/image-extensions
// Which is an npm package that is just a json file
export const imageExtensions = [
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
  "tga",
];

// https://github.com/sindresorhus/video-extensions/blob/main/video-extensions.json
export const videoExtensions = [
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
  "yuv",
];
