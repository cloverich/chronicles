import fs from "fs";
import path from "path";

/**
 * Resolve the directory containing highlight.js theme CSS files.
 *
 * Checks multiple candidate paths to work in both dev and production:
 * - Dev: node_modules/highlight.js/styles/ relative to cwd (project root)
 * - Production: hljs-themes/ relative to cwd (dist/ inside packaged app)
 */
function resolveHljsDir(): string {
  const candidates = [
    // Production: copied by build.sh into dist/hljs-themes/
    path.join(process.cwd(), "hljs-themes"),
    // Dev: read from node_modules
    path.join(process.cwd(), "node_modules/highlight.js/styles"),
  ];

  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }

  console.error(
    "highlight.js themes not found. Checked:",
    candidates.join(", "),
  );
  return candidates[0]; // return first candidate so callers get undefined, not throw
}

/**
 * Load an hljs theme's CSS content by name.
 * Names correspond to highlight.js theme filenames without extension,
 * e.g. "atom-one-dark", "github-dark", "nord", "base16/monokai".
 *
 * Returns the CSS string, or undefined if the theme is not found.
 */
export function loadHljsThemeCSS(themeName: string): string | undefined {
  const dir = resolveHljsDir();

  for (const ext of [".min.css", ".css"]) {
    const filePath = path.join(dir, `${themeName}${ext}`);
    try {
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, "utf-8");
      }
    } catch {
      continue;
    }
  }

  return undefined;
}

/**
 * List all available hljs theme names.
 * Returns names like "atom-one-dark", "github-dark", "base16/monokai".
 */
export function listHljsThemes(): string[] {
  const dir = resolveHljsDir();
  const themes: string[] = [];

  function scanDir(scanPath: string, prefix: string) {
    if (!fs.existsSync(scanPath)) return;
    try {
      for (const file of fs.readdirSync(scanPath)) {
        if (file.endsWith(".min.css")) {
          themes.push(`${prefix}${file.replace(".min.css", "")}`);
        } else if (file.endsWith(".css")) {
          const name = `${prefix}${file.replace(".css", "")}`;
          if (!themes.includes(name)) themes.push(name);
        }
      }
    } catch {
      // skip unreadable dirs
    }
  }

  scanDir(dir, "");
  scanDir(path.join(dir, "base16"), "base16/");

  return themes.sort();
}
