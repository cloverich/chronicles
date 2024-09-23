const fs = require("fs");
const mkdirp = require("mkdirp");

/**
 * Borrowed from api files, since its typescript and this is not
 * Reconcile that later
 */
exports.ensureDir = function ensureDir(directory) {
  if (!directory) {
    throw new Error("ensureDir called with no directory path");
  }

  try {
    const dir = fs.statSync(directory);
    if (!dir.isDirectory()) {
      throw new Error(
        `ensureDir called but ${directory} already exists as a file`,
      );
    }
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
    mkdirp.sync(directory);
  }

  // NOTE: Documentation suggests Windows may report ok here, but then choke
  // when actually writing. Better to move this logic to the actual file
  // upload handlers.
  fs.accessSync(directory, fs.constants.R_OK | fs.constants.W_OK);
};
