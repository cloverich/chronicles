import fs from "fs";
import path from "path";

/**
 * Resolve the directory containing bundled highlight.js theme CSS files.
 *
 * In development: reads from node_modules/highlight.js/styles/
 * In production: reads from dist/hljs-themes/ (copied by build.sh)
 */
function resolveHljsDir(): string {
  // Production: hljs-themes sits alongside the bundled app files
  const prodDir = path.join(__dirname, "hljs-themes");
  if (fs.existsSync(prodDir)) return prodDir;

  // Development: read directly from node_modules
  const devDir = path.resolve(__dirname, "../node_modules/highlight.js/styles");
  if (fs.existsSync(devDir)) return devDir;

  throw new Error(
    "highlight.js themes not found. Run yarn or build the app first.",
  );
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
  const filePath = path.join(dir, `${themeName}.min.css`);

  // Fall back to non-minified in dev
  const fallbackPath = path.join(dir, `${themeName}.css`);

  for (const p of [filePath, fallbackPath]) {
    try {
      if (fs.existsSync(p)) {
        return fs.readFileSync(p, "utf-8");
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

  try {
    for (const file of fs.readdirSync(dir)) {
      if (file.endsWith(".min.css")) {
        themes.push(file.replace(".min.css", ""));
      } else if (file.endsWith(".css") && !file.endsWith(".min.css")) {
        const name = file.replace(".css", "");
        if (!themes.includes(name)) themes.push(name);
      }
    }

    // Scan base16 subdirectory
    const base16Dir = path.join(dir, "base16");
    if (fs.existsSync(base16Dir)) {
      for (const file of fs.readdirSync(base16Dir)) {
        if (file.endsWith(".min.css")) {
          themes.push(`base16/${file.replace(".min.css", "")}`);
        } else if (file.endsWith(".css") && !file.endsWith(".min.css")) {
          const name = `base16/${file.replace(".css", "")}`;
          if (!themes.includes(name)) themes.push(name);
        }
      }
    }
  } catch {
    // Return whatever we found
  }

  return themes.sort();
}
