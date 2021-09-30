import mkdirp from "mkdirp";
import walk = require("klaw");
import path from "path";
import fs from "fs";
const { readFile, writeFile, access, stat } = fs.promises;
import { Stats } from "fs";
import { NotFoundError, ValidationError } from "./errors";
import { DateTime } from "luxon";
const readFileStr = (path: string) => readFile(path, "utf8");

import { ClientRequest, IncomingMessage } from "http";

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

  static async saveStream(req: IncomingMessage, filePath: string) {
    // Take in the request & filepath, stream the file to the filePath
    return new Promise((resolve, reject) => {
      const stream = fs.createWriteStream(filePath);
      // With the open - event, data will start being written
      // from the request to the stream's destination path
      stream.on("open", () => {
        console.log("Stream open ...  0.00%");
        req.pipe(stream);
      });

      // Drain is fired whenever a data chunk is written.
      // When that happens, print how much data has been written yet.
      //  stream.on('drain', () => {
      //   const written = stream.bytesWritten;
      //   const total = parseInt(req.headers['content-length']);
      //   const pWritten = ((written / total) * 100).toFixed(2);
      //   console.log(`Processing  ...  ${pWritten}% done`);
      //  });

      // When the stream is finished, print a final message
      // Also, resolve the location of the file to calling function
      stream.on("close", () => {
        console.log("Processing  ...  100%");
        resolve(filePath);
      });
      // If something goes wrong, reject the primise
      stream.on("error", (err) => {
        console.error(err);
        reject(err);
      });
    });
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
      if (shouldIndex(entry)) {
        yield entry as PathStatsFile;
      }
    }
  }

  /**
   * Check if a directory can be read and written.
   *
   * todo: What if it doesn't exist?
   *
   * @param filepath
   * @returns Error if cannot read and write, otherwise null
   */
  static async tryReadWrite(filepath: string): Promise<void> {
    return access(filepath, fs.constants.R_OK | fs.constants.W_OK);
  }

  /**
   * Ensure directory exists and can be accessed
   *
   * WARN: Logic to handle errors when writing / reading files from directory
   * are still needed as access check may be innaccurate or could change while
   * app is running.
   */
  static async ensureDir(directory: string): Promise<void> {
    try {
      const dir = await stat(directory);
      if (!dir.isDirectory()) {
        throw new Error(
          `ensureDir called but ${directory} already exists as a file`
        );
      }
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
      await mkdirp(directory);
    }

    // NOTE: Documentation suggests Windows may report ok here, but then choke
    // when actually writing. Better to move this logic to the actual file
    // upload handlers.
    await access(directory, fs.constants.R_OK | fs.constants.W_OK);
  }
}
