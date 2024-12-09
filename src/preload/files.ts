import fs, { Stats } from "fs";
import path from "path";
import { NotFoundError, ValidationError } from "./errors";
const { readFile, writeFile, access, stat } = fs.promises;
const readFileStr = (path: string) => readFile(path, "utf8");

import { IncomingMessage } from "http";

export interface PathStatsFile {
  path: string;
  stats: Stats;
}

type ShouldIndex = (file: fs.Dirent) => boolean;

// for matching exact (ex: 2020-05-01)
const reg = /^\d{4}-\d{2}-\d{2}$/;

/**
 * todo: This is probably legacy code from when I used importer/indexer on every startup;
 * Most of this should be moved to client.files and the legacy code removed.
 *
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
      date + ".md",
    );
  }

  static async mkdirp(dir: string) {
    try {
      await fs.promises.mkdir(dir, { recursive: true });
    } catch (err) {
      // If it already exists, good to go
      // note: ts can't find this type: instanceof ErrnoException
      if ((err as any).code === "EEXIST") {
        return dir;
      } else {
        throw err;
      }
    }
  }

  static async read(fp: string) {
    try {
      return await readFileStr(fp);
    } catch (err: any) {
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
        "[Files.save] contents are required to save a file",
      );
    }

    // TODO: Unit test
    // TODO: More robust, assert range: i.e. positive ints, etc...
    // probably just do a date parse to be safe
    if (!reg.test(date)) {
      throw new ValidationError(
        "[Files.save] date must match format YYYY-MM-DD",
      );
    }
    const fp = Files.pathForEntry(journalPath, date);
    const dir = path.parse(fp).dir;

    await Files.mkdirp(dir);
    return await writeFile(fp, contents);
  }

  /**
   * Save the incoming request body as a file
   *
   * https://dev.to/tqbit/how-to-use-node-js-streams-for-fileupload-4m1n
   */
  static async saveStream(req: IncomingMessage, filePath: string) {
    // Take in the request & filepath, stream the file to the filePath
    return new Promise((resolve, reject) => {
      const stream = fs.createWriteStream(filePath);

      // Not actually sure if I need to setup the listeners this way,
      // particularly the open listener
      stream.on("open", () => {
        req.pipe(stream);
      });

      stream.on("close", () => {
        resolve(filePath);
      });

      // If something goes wrong, reject the primise
      stream.on("error", (err) => {
        reject(err);
      });
    });
  }

  /**
   * Walk directory, for index and sync routines
   * @param dir - Where to start walking
   * @param depthLimit - A limit on how deep to walk
   * @param shouldIndex - A function that determines whether to index a file / directory
   *
   * usage:
   * ```
   * for await (const file of Files.walk2(rootDir, 1, shouldIndex)) { ... }
   * ```
   */
  static async *walk(
    dir: string,
    depthLimit = Infinity,
    shouldIndex: ShouldIndex,
    currentDepth = 0,
  ): AsyncGenerator<PathStatsFile> {
    if (currentDepth > depthLimit) return;

    const dirHandle = await fs.promises.opendir(dir);
    for await (const entry of dirHandle) {
      const fullPath = path.join(dir, entry.name);

      // Skip hidden files/directories or other excluded names
      if (entry.isSymbolicLink()) continue; // Skip symlinks entirely
      if (!shouldIndex(entry)) continue;

      if (entry.isDirectory()) {
        // we don't yield directories, just contents
        yield* Files.walk(fullPath, depthLimit, shouldIndex, currentDepth + 1);
      } else {
        const stats = await fs.promises.lstat(fullPath); // Use lstat to check for symlinks
        yield { path: fullPath, stats }; // Yield file path and stats
      }
    }
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
          `ensureDir called but ${directory} already exists as a file`,
        );
      }
    } catch (err: any) {
      if (err.code !== "ENOENT") throw err;
      await Files.mkdirp(directory);
    }

    // NOTE: Documentation suggests Windows may report ok here, but then choke
    // when actually writing. Better to move this logic to the actual file
    // upload handlers.
    await access(directory, fs.constants.R_OK | fs.constants.W_OK);
  }
}
