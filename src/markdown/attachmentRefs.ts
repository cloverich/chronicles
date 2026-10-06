/**
 * Attachment reference grammar; spec: `spec/data-model.md` ("Attachment
 * references"). Stored form: `chronicles://attachment/<sha256><ext>`.
 */

export const ATTACHMENT_URL_PREFIX = "chronicles://attachment/";

const storedRegex = /^chronicles:\/\/attachment\/([0-9a-f]{64})(\.[a-z0-9]+)?$/;

export function attachmentUrl(sha256: string, ext: string): string {
  return `${ATTACHMENT_URL_PREFIX}${sha256}${ext}`;
}

export function parseAttachmentUrl(
  url: string,
): { sha256: string; ext: string } | null {
  const m = url?.match(storedRegex);
  return m ? { sha256: m[1], ext: m[2] ?? "" } : null;
}

/** Pool path relative to `_attachments/`: `<sha[0:2]>/<sha><ext>`. */
export function attachmentPoolPath(sha256: string, ext: string): string {
  return `${sha256.slice(0, 2)}/${sha256}${ext}`;
}

/** Lowercased extension (with dot) if it is a plain alphanumeric one, else "". */
export function normalizeAttachmentExt(name: string): string {
  const m = name.match(/(\.[A-Za-z0-9]+)$/);
  return m ? m[1].toLowerCase() : "";
}
