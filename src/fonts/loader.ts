import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const SUPPORTED_FONT_EXTENSIONS = new Set([".ttf", ".otf", ".woff2"]);
const VARIABLE_FONT_FAMILIES = new Set(["Mona Sans", "Hubot Sans"]);
const FONT_CSS_FILENAME = "fonts.css";

interface FontFaceAttributes {
  fontStyle: "normal" | "italic";
  fontWeight: string;
}

function getFontFaceAttributes(
  familyName: string,
  fileName: string,
): FontFaceAttributes {
  const lowerCaseName = fileName.toLowerCase();
  const isItalic = lowerCaseName.includes("italic");

  if (VARIABLE_FONT_FAMILIES.has(familyName)) {
    return {
      fontStyle: isItalic ? "italic" : "normal",
      fontWeight: "200 900",
    };
  }

  if (lowerCaseName.includes("thin") || lowerCaseName.includes("hairline")) {
    return { fontStyle: isItalic ? "italic" : "normal", fontWeight: "100" };
  }

  if (lowerCaseName.includes("light")) {
    return { fontStyle: isItalic ? "italic" : "normal", fontWeight: "300" };
  }

  if (lowerCaseName.includes("medium")) {
    return { fontStyle: isItalic ? "italic" : "normal", fontWeight: "500" };
  }

  if (lowerCaseName.includes("semibold")) {
    return { fontStyle: isItalic ? "italic" : "normal", fontWeight: "600" };
  }

  if (lowerCaseName.includes("bold")) {
    return { fontStyle: isItalic ? "italic" : "normal", fontWeight: "700" };
  }

  if (lowerCaseName.includes("black") || lowerCaseName.includes("heavy")) {
    return { fontStyle: isItalic ? "italic" : "normal", fontWeight: "900" };
  }

  return { fontStyle: isItalic ? "italic" : "normal", fontWeight: "400" };
}

function getFormatFromExtension(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".ttf") return "truetype";
  if (ext === ".otf") return "opentype";
  return "woff2";
}

function readDirEntriesSafe(dirPath: string): fs.Dirent[] {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (err) {
    console.warn(`Could not read directory "${dirPath}":`, err);
    return [];
  }
}

function readFileSafe(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

/**
 * List user-installed font families from `<settingsDir>/fonts`.
 * Family names are folder names, sorted alphabetically.
 */
export function listInstalledFonts(fontsDir: string): string[] {
  if (!fs.existsSync(fontsDir)) {
    return [];
  }

  return readDirEntriesSafe(fontsDir)
    .filter((entry) => entry.isDirectory())
    .filter((entry) => entry.name !== "." && entry.name !== "..")
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Build `@font-face` CSS for user-installed fonts under `<settingsDir>/fonts`.
 */
export function buildFontsCSSFile(fontsDir: string): string {
  const families = listInstalledFonts(fontsDir);
  const fontFaceRules: string[] = [];

  for (const familyName of families) {
    const familyDir = path.join(fontsDir, familyName);

    const files = readDirEntriesSafe(familyDir)
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));

    for (const fileName of files) {
      const filePath = path.join(familyDir, fileName);

      const ext = path.extname(fileName).toLowerCase();
      if (!SUPPORTED_FONT_EXTENSIONS.has(ext)) {
        continue;
      }

      const attributes = getFontFaceAttributes(familyName, fileName);
      const fontUrl = pathToFileURL(filePath).href;
      const format = getFormatFromExtension(filePath);

      fontFaceRules.push(`@font-face {
  font-family: ${JSON.stringify(familyName)};
  src: url(${JSON.stringify(fontUrl)}) format(${JSON.stringify(format)});
  font-style: ${attributes.fontStyle};
  font-weight: ${attributes.fontWeight};
  font-display: swap;
}`);
    }
  }

  return fontFaceRules.join("\n\n");
}

/**
 * Get path to the generated fonts.css file
 */
export function getFontsCSSFile(fontsDir: string): string {
  return path.join(fontsDir, FONT_CSS_FILENAME);
}

/**
 * Get an <link href="..." /> compatible url to the generated fonts.css file
 */
export function getFontsCSSStylesheetHref(fontsDir: string): string | null {
  const cssPath = getFontsCSSFile(fontsDir);
  if (!fs.existsSync(cssPath)) {
    return null;
  }

  let stats: fs.Stats;
  try {
    stats = fs.statSync(cssPath);
  } catch {
    return null;
  }

  return `${pathToFileURL(cssPath).href}?v=${stats.mtimeMs}`;
}

export interface RefreshInstalledFontsCacheResult {
  changed: boolean;
  href: string | null;
}

/**
 * Generate fonts.css from contents of custom fonts directory
 * (if any), and return file path + flag if it changed
 */
export function refreshFontsCSSFile(
  fontsDir: string,
): RefreshInstalledFontsCacheResult {
  const cssPath = getFontsCSSFile(fontsDir);
  const nextCss = buildFontsCSSFile(fontsDir);
  const previousCss = readFileSafe(cssPath);

  if (!nextCss) {
    if (previousCss !== null) {
      fs.rmSync(cssPath, { force: true });
      return { changed: true, href: null };
    }

    return { changed: false, href: null };
  }

  if (previousCss === nextCss) {
    return {
      changed: false,
      href: getFontsCSSStylesheetHref(fontsDir),
    };
  }

  fs.writeFileSync(cssPath, nextCss, "utf8");
  return {
    changed: true,
    href: getFontsCSSStylesheetHref(fontsDir),
  };
}

export { getFontFaceAttributes };
