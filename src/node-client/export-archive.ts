import fs from "fs";
import path from "path";
import yauzl from "yauzl";
import yazl from "yazl";

import { compareCodePoints } from "./canonical-note";
import { isSameOrInside } from "./fs-guards";

/**
 * The single-file form of an export (spec/export-format.md, "Single-file
 * form"): a zip holding exactly the export tree, entries at the root.
 */

export const ARCHIVE_SUFFIX = ".chronicles.zip";

/** Whether `p` names a zip file (by content type, not the `.chronicles` part). */
export async function isArchiveFile(p: string): Promise<boolean> {
  try {
    const stat = await fs.promises.stat(p);
    if (!stat.isFile()) return false;
    const fd = await fs.promises.open(p, "r");
    try {
      const magic = Buffer.alloc(4);
      await fd.read(magic, 0, 4, 0);
      // Local file header, or an empty archive's end-of-central-directory.
      return (
        magic.equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) ||
        magic.equals(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
      );
    } finally {
      await fd.close();
    }
  } catch (err: any) {
    if (err?.code === "ENOENT") return false;
    throw err;
  }
}

/** Every file under dir, as `/`-separated relative paths. */
function listFiles(dir: string): string[] {
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) =>
      path
        .relative(dir, path.join(e.parentPath, e.name))
        .split(path.sep)
        .join("/"),
    );
}

const TEXT_EXTENSIONS = new Set([".md", ".json"]);

/**
 * Zip `treeDir` into `destFile`: file entries only, `manifest.json` first,
 * then code-point order. Notes and JSON are deflated; attachments (mostly
 * already-compressed images) are stored. yazl sets the UTF-8 name flag and
 * switches to Zip64 only when sizes or entry counts need it.
 */
export async function writeArchive(
  treeDir: string,
  destFile: string,
  opts: { forceZip64?: boolean; mtime?: Date } = {},
): Promise<void> {
  const files = listFiles(treeDir).sort((a, b) =>
    a === "manifest.json"
      ? -1
      : b === "manifest.json"
        ? 1
        : compareCodePoints(a, b),
  );

  const zip = new yazl.ZipFile();
  const mtime = opts.mtime ?? new Date();
  for (const rel of files) {
    zip.addFile(path.join(treeDir, ...rel.split("/")), rel, {
      mtime,
      mode: 0o100644,
      compress: TEXT_EXTENSIONS.has(path.extname(rel).toLowerCase()),
      forceZip64Format: opts.forceZip64 ?? false,
    });
  }

  await new Promise<void>((resolve, reject) => {
    const out = fs.createWriteStream(destFile, { flags: "wx" });
    out.on("error", reject);
    out.on("close", resolve);
    zip.outputStream.on("error", reject).pipe(out);
    zip.end({ forceZip64Format: opts.forceZip64 ?? false, comment: "" });
  });
}

function openZip(file: string): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) =>
    yauzl.open(
      file,
      { lazyEntries: true, autoClose: false, strictFileNames: true },
      (err, zip) => (err ? reject(err) : resolve(zip!)),
    ),
  );
}

function readEntries(zip: yauzl.ZipFile): Promise<yauzl.Entry[]> {
  return new Promise((resolve, reject) => {
    const entries: yauzl.Entry[] = [];
    zip.on("entry", (entry: yauzl.Entry) => {
      entries.push(entry);
      zip.readEntry();
    });
    zip.on("end", () => resolve(entries));
    zip.on("error", reject);
    zip.readEntry();
  });
}

const S_IFMT = 0o170000;
const S_IFLNK = 0o120000;

/**
 * Extract an export archive into `destDir` (which must exist and be empty).
 * Validates every entry before writing any: no absolute or `..` names, no
 * backslashes (yauzl's strictFileNames), no symlinks, no encryption, only
 * stored or deflate.
 */
export async function extractArchive(
  file: string,
  destDir: string,
): Promise<void> {
  const zip = await openZip(file);
  try {
    const entries = await readEntries(zip);
    const files = entries.filter((e) => !e.fileName.endsWith("/"));

    const seen = new Set<string>();
    for (const entry of files) {
      const name = entry.fileName;
      if (seen.has(name)) {
        throw new Error(`[IMPORT_ARCHIVE_INVALID] Duplicate entry: ${name}`);
      }
      seen.add(name);
      if (((entry.externalFileAttributes >>> 16) & S_IFMT) === S_IFLNK) {
        throw new Error(
          `[IMPORT_ARCHIVE_INVALID] Symbolic link entry: ${name}`,
        );
      }
      if (entry.isEncrypted()) {
        throw new Error(`[IMPORT_ARCHIVE_INVALID] Encrypted entry: ${name}`);
      }
      if (entry.compressionMethod !== 0 && entry.compressionMethod !== 8) {
        throw new Error(
          `[IMPORT_ARCHIVE_INVALID] Unsupported compression method ${entry.compressionMethod}: ${name}`,
        );
      }
      if (!isSameOrInside(path.join(destDir, name), destDir)) {
        throw new Error(`[IMPORT_ARCHIVE_INVALID] Unsafe entry name: ${name}`);
      }
    }

    for (const entry of files) {
      const dest = path.join(destDir, ...entry.fileName.split("/"));
      await fs.promises.mkdir(path.dirname(dest), { recursive: true });
      const stream = await new Promise<NodeJS.ReadableStream>(
        (resolve, reject) =>
          zip.openReadStream(entry, (err, s) =>
            err ? reject(err) : resolve(s!),
          ),
      );
      await new Promise<void>((resolve, reject) => {
        const out = fs.createWriteStream(dest, { flags: "wx" });
        stream.on("error", reject);
        out.on("error", reject);
        out.on("close", resolve);
        stream.pipe(out);
      });
    }
  } finally {
    zip.close();
  }
}
