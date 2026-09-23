import fs from "fs";
import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import os from "os";
import path from "path";
import { syncFolderContaining } from "./sync-folders";

describe("syncFolderContaining", () => {
  const home = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "chronicles-home-")),
  );
  const cloud = path.join(home, "Library", "CloudStorage");
  fs.mkdirSync(path.join(cloud, "Dropbox"), { recursive: true });
  fs.mkdirSync(path.join(home, "Library", "Mobile Documents"), {
    recursive: true,
  });
  fs.symlinkSync(path.join(cloud, "Dropbox"), path.join(home, "Dropbox"));

  after(() => fs.rmSync(home, { recursive: true, force: true }));

  const cases: [string, string, string | null][] = [
    [
      "iCloud Drive",
      "Library/Mobile Documents/com~apple~CloudDocs/Notes",
      "iCloud Drive",
    ],
    [
      "Google Drive",
      "Library/CloudStorage/GoogleDrive-me@example.com/My Drive/notes",
      "GoogleDrive",
    ],
    ["OneDrive", "Library/CloudStorage/OneDrive-Personal/notes", "OneDrive"],
    ["a symlink into CloudStorage", "Dropbox/notes", "Dropbox"],
    ["a plain folder", "Documents/notes", null],
    ["Application Support", "Library/Application Support/Chronicles", null],
  ];

  for (const [name, rel, expected] of cases) {
    test(name, () => {
      assert.equal(syncFolderContaining(path.join(home, rel), home), expected);
    });
  }
});
