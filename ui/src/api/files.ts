import mkdirp from "mkdirp";
import walk = require("klaw");
import path from "path";
import fs from "fs";
const { readFile, writeFile } = fs.promises;
import { Stats } from "fs";
const readFileStr = (path: string) => readFile(path, "utf8");

// for matching exact
const reg = /^\d{4}-\d{2}-\d{2}$/;

/**
 * FileDAO has methods for finding and fetching documents from the file system
 */
export class Files {
  static isValidDirectory(directory: string) {
    // well this feels superfluous
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

  static async read(journalPath: string, date: string) {
    const fp = Files.pathForEntry(journalPath, date);
    return await readFileStr(fp);
  }

  static async save(journalPath: string, date: string, contents: string) {
    if (!contents || !contents.trim()) {
      throw new Error("[FileDAO.save] contents are required to save a file");
    }

    // TODO: Unit test
    // TODO: More robust, assert range: i.e. positive ints, etc...
    // probably just do a date parse to be safe
    if (!reg.test(date)) {
      throw new Error("[FileDAO.save] date must match format YYYY-MM-DD");
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
   */
  static walk = async (srcDir: string, name: string) => {
    const sr = {
      count: 0,
      results: [] as string[],
      journal: name,
      path: srcDir,
    };

    // todo: filter .dotfiles, asset dirctories, etc
    // todo: collect and report on statistics, like directory size
    // num files time taken etc
    const walking = walk(srcDir);

    // NOTE: Docs say walk is lexicographical but if I log out statements, its not walking in order
    for await (const entry of walking) {
      if (shouldIndex(entry)) {
        // todo: more efficiently could begin indexing while walking
        sr.results.push(path.parse(entry.path).name);
      }
    }

    return sr;
  };
}

interface PathStatsFile {
  path: string;
  stats: Stats;
}

const fileformat = /\/(\d{4})\/(\d{2})\/(\d{4})-(\d{2})-\d{2}/;

function shouldIndex(file: PathStatsFile): boolean {
  if (file.stats.isDirectory()) return false;

  const { ext, name } = path.parse(file.path);
  if (ext !== ".md") return false;
  if (name.startsWith(".")) return false;

  const segments = fileformat.exec(file.path);
  // Match: ['...2016-02-15.md', '2016', '02', '2016', '02']

  if (!segments) return false;
  if (segments.length !== 5) return false;
  if (segments[1] !== segments[3] || segments[2] !== segments[4]) return false;

  return true;
}
