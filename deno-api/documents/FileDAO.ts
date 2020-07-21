import {
  ensureDir,
  readFileStr,
  writeFileStr,
} from "https://deno.land/std@v0.61.0/fs/mod.ts";
import * as path from "https://deno.land/std@v0.61.0/path/mod.ts";

// for matching exact
const reg = /^\d{4}-\d{2}-\d{2}$/;

/**
 * FileDAO has methods for finding and fetching documents from the file system
 */
export class FileDAO {
  static pathForEntry(journalPath: string, date: string) {
    return path.join(
      journalPath,
      date.slice(0, 4),
      date.slice(5, 7),
      date + ".md"
    );
  }

  static async read(journalPath: string, date: string) {
    const fp = FileDAO.pathForEntry(journalPath, date);
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
    const fp = FileDAO.pathForEntry(journalPath, date);
    const dir = path.parse(fp).dir;

    await ensureDir(dir);
    return await writeFileStr(fp, contents);
  }
}
