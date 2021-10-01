import ky from "ky-universal";
type Ky = typeof ky;

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

  // get() is handled via img tag's src parameter

  upload = (file: File): Promise<UploadResponse> => {
    return this.ky("v2/images", {
      method: "post",
      body: file,
    }).json();
  };
}
