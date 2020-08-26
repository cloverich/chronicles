import mkdirp from "mkdirp";
import walk = require("klaw");
import path from "path";
import fs from "fs";
const { readFile, writeFile } = fs.promises;
import { Stats } from "fs";
import { NotFoundError, ValidationError } from "./errors";
import { DateTime } from "luxon";
const readFileStr = (path: string) => readFile(path, "utf8");

export interface PathStatsFile {
  path: string;
  stats: Stats;
}

type ShouldIndex = (file: PathStatsFile) => boolean;

// for matching exact (ex: 2020-05-01)
const reg = /^\d{4}-\d{2}-\d{2}$/;

/**
 * FileDAO has methods for finding and fetching documents from the file system
 */
export class Files {
  static isValidDirectory(directory: string) {
    // well this feels superfluous
    // todo... this doesn't stat.isDirectory? WTF
    return fs.existsSync(directory);
  }

  static pathForEntry(journalPath: string, date: string) {
    return path.join(
      journalPath,
      date.slice(0, 4),
      date.slice(5, 7),
      date + ".md"
    );
  }

  static async read(fp: string) {
    try {
      return await readFileStr(fp);
    } catch (err) {
      if (err.code === "ENOENT") {
        throw new NotFoundError(`Document at ${fp} does not exist.`);
      } else {
        throw err;
      }
    }
  }

  static async save(journalPath: string, date: string, contents: string) {
    if (!contents || !contents.trim()) {
      throw new ValidationError(
        "[Files.save] contents are required to save a file"
      );
    }

    // TODO: Unit test
    // TODO: More robust, assert range: i.e. positive ints, etc...
    // probably just do a date parse to be safe
    if (!reg.test(date)) {
      throw new ValidationError(
        "[Files.save] date must match format YYYY-MM-DD"
      );
    }
    const fp = Files.pathForEntry(journalPath, date);
    const dir = path.parse(fp).dir;

    await mkdirp(dir);
    return await writeFile(fp, contents);
  }

  /**
   *
   * @param srcDir - Journal directory to walk,looking for files to index
   * @param name - The journal name. Treated as a key to the journals table. Stupid.
   *
   * todo: If bored, implement a more efficient and easier to work with API:
   * - Implement walk with w/ node APIs
   * - Filter on filename -- avoid non-journal directories and calling fs.stat needlessly
   */
  static async *walk(directory: string, shouldIndex: ShouldIndex) {
    // todo: statistics
    const walking = walk(directory);

    // NOTE: Docs say walk is lexicographical but if I log out statements, its not walking in order
    for await (const entry of walking) {
      console.log("[Files.walk] calling shouldIndex with", entry.path);
      if (shouldIndex(entry)) {
        yield entry as PathStatsFile;
      }
    }
  }
}
