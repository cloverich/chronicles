import electron, { app } from "electron";
console.log("handlers.files", electron, app);

import { RouterContext } from "@koa/router";
import settings from "electron-settings";
import send from "koa-send";
import cuid from "cuid";
import path from "path";
import fs from "fs";
import { Files } from "../files";
import mime from "mime";

/**
 * The Files service knows was setup for supporting image
 * upload for documents. Previously the UI used local files
 * and insecure settings only.
 */
export class FilesHandler {
  assetsPath: string;

  /**
   *
   * @param assetsPath A pre-validated path to use for user files (images, etc)
   */
  constructor(assetsPath: string) {
    this.assetsPath = assetsPath;
  }

  /**
   * Validate assets path (in settings) and instantiate a FilesHandler with it.
   */
  static async create(userDataDir: string) {
    // I would prefer to do this in a formal start-up routine, although I suppose creating
    // api handlers is a reasonable place to have that logic.
    // todo: validate path is valid, readable, writeable
    let assetsPath = settings.getSync("USER_FILES_DIR");

    if (!assetsPath) {
      const defaultUserFilesDir = path.join(
        userDataDir,
        "chronicles_user_images"
      );
      console.log(
        `USER_FILES_DIR not found in settings. Using ${userDataDir} and udpating settings`
      );

      await Files.ensureDir(defaultUserFilesDir);

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
      await Files.tryReadWrite(assetsPath);
      return new FilesHandler(assetsPath);
    } catch (err) {
      throw new Error(
        `FilesHandler cannot read or write ${assetsPath}. Access is necessary to upload and serve user files!`
      );
    }
  }

  /**
   * Get a (user) file
   */
  get = async (ctx: RouterContext) => {
    const filename = ctx.params.key;
    if (!filename) {
      ctx.response.status = 400;
      ctx.response.body = {
        title: "Filename must be passed in path",
      };
      return;
    }

    console.log("looking for filename", filename);
    await send(ctx, filename, {
      root: this.assetsPath,
    });
  };

  upload = async (ctx: RouterContext) => {
    // The browser sets the mime type when `File` is passed to fetch
    // as the Content-Type header: ex: image/png, video/mp4
    // https://stackoverflow.com/questions/1201945/how-is-mime-type-of-an-uploaded-file-determined-by-browser
    // https://github.com/broofa/mime
    const extension = mime.getExtension(ctx.request.headers["content-type"]);
    const filename = `${cuid()}.${extension || ".unknown"}`;
    const filepath = path.join(this.assetsPath, filename);

    // todo: make more robust, etc
    if (filename.endsWith("unknown")) {
      console.log(
        "content-type mime detection failed (",
        ctx.request.headers["content-type"],
        "), using `.unknown` instead..."
      );
    }

    try {
      await Files.saveStream(ctx.req, filepath);
      ctx.response.status = 200;
      ctx.response.body = {
        filename,
        filepath,
      };
    } catch (err) {
      ctx.response.status = 500;
    }
  };

  /**
   * Originally a catch all for serving all files, images and I think
   * other HTML assets too. Named "unsafe" to indicate this is a hack.
   * Instead:
   *
   * 1. Serve app assets from a specific, app controlled location
   * 2. Server image assets from the new image route (above)
   *
   * (Or, abandont the API and do it all with electron logic in a preload script)
   */
  getUnsafe = async (ctx: RouterContext) => {
    // Replace url encoded characters, ex: %20 -> space
    const url = decodeURI(ctx.request.path);

    await send(ctx, url, {
      root: "/",
    });
  };
}
