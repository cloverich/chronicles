import fs from "fs";
import path from "path";
import { validate } from "./schema";

export interface ImportThemeResult {
  success: boolean;
  errors?: string[];
  themeName?: string;
}

/**
 * Import a theme file from disk into the themes directory.
 *
 * 1. Reads the file at `filePath`.
 * 2. Parses the JSON content.
 * 3. Validates against the ThemeConfig schema.
 * 4. If valid, copies the file to `themesDir/<original-filename>`.
 *
 * @param filePath  Absolute path to the .theme.json file to import.
 * @param themesDir Absolute path to the directory where themes are stored.
 * @returns         Result object indicating success or failure with error details.
 */
export function importThemeFile(
  filePath: string,
  themesDir: string,
): ImportThemeResult {
  // Read the file
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    return {
      success: false,
      errors: [
        `Could not read file: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      success: false,
      errors: [
        `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  // Validate against schema
  const { valid, errors } = validate(parsed);
  if (!valid) {
    return { success: false, errors };
  }

  // Extract theme name for the success message (safe cast after validation)
  const themeName = (parsed as { name: string }).name;

  // Ensure themes directory exists
  try {
    if (!fs.existsSync(themesDir)) {
      fs.mkdirSync(themesDir, { recursive: true });
    }
  } catch (err) {
    return {
      success: false,
      errors: [
        `Could not create themes directory: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  // Copy file to themes directory using the original filename
  const filename = path.basename(filePath);
  const destPath = path.join(themesDir, filename);
  try {
    fs.copyFileSync(filePath, destPath);
  } catch (err) {
    return {
      success: false,
      errors: [
        `Could not copy theme file: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  return { success: true, themeName };
}
