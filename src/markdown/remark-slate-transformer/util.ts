/**
 * NOTE: COPIED FROM editor/blocks/images.tsx
 *
 * For absolute image urls, prefix them with chronicles:// which will trigger
 * the protocol handler in the main process, which as of now merely serves
 * the file
 *
 * When implementing drag and drop and accounting for other legacy journals,
 * many image files were absolute filepaths to various places on the filesystem
 *
 * todo: Upload and host all image files from a single directory
 *
 * @param url
 * @returns
 */
export function prefixUrl(url: string) {
  const isLocalPath = !url.startsWith("http");

  if (isLocalPath) {
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
