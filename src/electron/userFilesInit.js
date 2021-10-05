const settings = require('electron-settings');
const path = require('path');
const fs = require("fs");
const mkdirp = require("mkdirp");

exports.initUserFilesDir = function initUserFilesDir(userDataDir) {
  // I would prefer to do this in a formal start-up routine, although I suppose creating
  // api handlers is a reasonable place to have that logic.
  // todo: validate path is valid, readable, writeable
  let assetsPath = settings.getSync("USER_FILES_DIR");

  // Create and set a default directory if it does not exist
  if (!assetsPath) {
    const defaultUserFilesDir = path.join(
      userDataDir,
      "chronicles_user_images"
    );
    console.log(
      `USER_FILES_DIR not found in settings. Using ${userDataDir} and udpating settings`
    );

    settings.setSync("USER_FILES_DIR", defaultUserFilesDir);
    assetsPath = defaultUserFilesDir;
  }

  // Not sure, but better something than silence
  if (typeof assetsPath !== "string") {
    console.error(
      "assets path is not a string",
      assetsPath,
      "typeof: ",
      typeof assetsPath
    );
    throw new Error(
      "Assets path is not a string, FilesHandler cannot proceed without the assetsPath directory being a string pointing to a valid, accessible file path"
    );
  }

  console.log("serving user assets from", assetsPath);

  try {
    ensureDir(assetsPath);

    // todo: no way to keep this cached path in sync if settings changes
    // since that is performed in the main process
    // return new FilesHandler(/*assetsPath*/);
  } catch (err) {
    throw new Error(
      `FilesHandler cannot read or write ${assetsPath}. Access is necessary to upload and serve user files!`
    );
  }
}


  /**
   * Borrowed from api files, since its typescript and this is not
   * Reconcile that later
   */
function ensureDir(directory) {
    try {
      const dir = fs.statSync(directory);
      if (!dir.isDirectory()) {
        throw new Error(
          `ensureDir called but ${directory} already exists as a file`
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
  }

