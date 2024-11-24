import path from "path";
import { Files, PathStatsFile } from "../../files";
import { SKIPPABLE_FILES } from "../importer";

// For resolving ![[Wiki Embedding]] links, I need a complete list of all non-.md
// files in the import directory, these ridiuclous things are not absolute or
// relative and could be anywhere in the import directory.
export class WikiFileResolver {
  // maps filename (ex: 2024-11-17-20241118102000781.webp) to PathStatsFile
  private nameMapping: Record<string, PathStatsFile> = {};

  private constructor(files: PathStatsFile[]) {
    files.forEach((file) => {
      let name = path.basename(file.path);
      this.nameMapping[name] = file;
    });
  }

  static async init(importDir: string) {
    let files = [];

    for await (const file of Files.walk(importDir, (filestats) => {
      if (!filestats.stats.isFile()) return false;

      const name = path.basename(filestats.path);
      if (name.startsWith(".")) return false;
      if (SKIPPABLE_FILES.has(name)) return false;
      return !filestats.path.endsWith(".md");
    })) {
      files.push(file);
    }

    return new WikiFileResolver(files);
  }

  resolve(name: string): string | undefined {
    const filestats = this.nameMapping[name];
    if (!filestats) {
      return;
    }

    return filestats.path;
  }
}
