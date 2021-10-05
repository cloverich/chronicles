import ky from "ky-universal";
type Ky = typeof ky;

import settings from "electron-settings";
import fs from "fs";
import path from "path";
import cuid from "cuid";

export interface Preferences {
  DATABASE_URL: string;
  PREFERENCES_FILE: string;
}

interface UploadResponse {
  filename: string;
  // filepath: string;
}

export class FilesClient {
  constructor(private ky: Ky) {}

  upload = async (file: File): Promise<UploadResponse> => {
    const dir = await settings.get("USER_FILES_DIR");
    const ext = path.parse(file.name).ext;
    const filename = `${cuid()}.${ext || ".unknown"}`;
    const filepath = path.join(dir as string, filename);

    return new Promise<UploadResponse>((res, rej) => {
      const stream = fs.createWriteStream(filepath);

      // the fs write stream is not compatible with the input stream :(
      // file.stream().pipeTo(stream);

      // Normally, .path is not available in browsers. But in electron, it is.
      const inStream = fs.createReadStream((file as any).path);
      inStream
        .pipe(stream)
        .on("close", () => res({ filename: filename }))
        .on("error", (err) => rej(err));
    });
  };
}
