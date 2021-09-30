import { describe, it } from "mocha";

describe("Preferences", function () {
  it("creates a default settings file in the user data directory");
  it("sets a default user_files_directory in the settings file");
  it("fails to start if the user_files_directory cannot be accessed");
});

describe("Uploading files", function () {
  it("uploads a copy of the file if you drag and drop a file on to the editor");

  // aspirational
  it(
    "displays a user error message if it is unable to upload a file to the user_files_directory for permission reasons"
  );
  it("name files with unique ids and proper file extensions");
  it("displays image files in the editor after uploading");
  it("displays video files in the editor after uploading");
});
