import { RouterContext } from "@koa/router";
import send from "koa-send";
import cuid from "cuid";
import path from "path";
import { Files } from "../files";
import mime from "mime";

/**
 * The Files service knows was setup for supporting image
 * upload for documents. Previously the UI used local files
 * and insecure settings only.
 */
export class FilesHandler {
  // todo: keep this in sync or abandon the backend...
  private USER_FILES_DIR: string;

  constructor(USER_FILES_DIR: string) {
    this.USER_FILES_DIR = USER_FILES_DIR;
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

    await send(ctx, filename, {
      root: this.USER_FILES_DIR,
    });
  };

  upload = async (ctx: RouterContext) => {
    // The browser sets the mime type when `File` is passed to fetch
    // as the Content-Type header: ex: image/png, video/mp4
    // https://stackoverflow.com/questions/1201945/how-is-mime-type-of-an-uploaded-file-determined-by-browser
    // https://github.com/broofa/mime
    const extension = mime.getExtension(ctx.request.headers["content-type"]);
    const filename = `${cuid()}.${extension || ".unknown"}`;
    const filepath = path.join(this.USER_FILES_DIR, filename);

    // todo: make more robust
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

        // note: Client should only deal in the relatie, not full, filepath
        // so the USER_FILES_DIR can be changed and the image links in notes
        // still work.
        // filepath,
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
   * (Or, abandon the API and do it all with electron logic in a preload script)
   */
  getUnsafe = async (ctx: RouterContext) => {
    // Replace url encoded characters, ex: %20 -> space
    const url = decodeURI(ctx.request.path);

    await send(ctx, url, {
      root: "/",
    });
  };
}
