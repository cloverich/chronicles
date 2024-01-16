import Store from "electron-store";

import fs from "fs";
import path from "path";
import { uuidv7 } from "uuidv7";

export interface Preferences {
  DATABASE_URL: string;
  PREFERENCES_FILE: string;
}

interface UploadResponse {
  filename: string;
  // filepath: string;
}

export type IFilesClient = FilesClient;

export class FilesClient {
  constructor(private settings: Store) {}

  upload = async (file: File): Promise<UploadResponse> => {
    const dir = await this.settings.get("USER_FILES_DIR");
    const ext = path.parse(file.name).ext;
    const filename = `${uuidv7()}.${ext || ".unknown"}`;
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
