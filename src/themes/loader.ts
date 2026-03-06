import fs from "fs";
import path from "path";
import { BUILTIN_THEMES } from "./builtins";
import { ThemeConfig, validate } from "./schema";

export interface ThemeListEntry {
  name: string;
  mode: "light" | "dark" | "both";
  builtin: boolean;
}

/**
 * List all available themes: built-ins plus any valid installed themes.
 *
 * 1. Starts with the built-in themes from BUILTIN_THEMES.
 * 2. Reads all `.json` files from `themesDir`.
 * 3. Parses and validates each file with `validate()`.
 * 4. Returns the combined list, skipping invalid files (logs a warning).
 * 5. If `themesDir` doesn't exist, returns only builtins.
 *
 * @param themesDir Absolute path to the user themes directory.
 */
export function listAvailableThemes(themesDir: string): ThemeListEntry[] {
  const entries: ThemeListEntry[] = Object.values(BUILTIN_THEMES).map(
    (theme) => ({
      name: theme.name,
      mode: theme.mode,
      builtin: true,
    }),
  );

  if (!fs.existsSync(themesDir)) {
    return entries;
  }

  let files: string[];
  try {
    files = fs.readdirSync(themesDir);
  } catch (err) {
    console.warn(
      `listAvailableThemes: could not read themes directory "${themesDir}":`,
      err,
    );
    return entries;
  }

  for (const file of files) {
    if (!file.endsWith(".json")) continue;

    const filePath = path.join(themesDir, file);
    let raw: string;
    try {
      raw = fs.readFileSync(filePath, "utf-8");
    } catch (err) {
      console.warn(
        `listAvailableThemes: could not read theme file "${filePath}":`,
        err,
      );
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.warn(
        `listAvailableThemes: invalid JSON in theme file "${filePath}":`,
        err,
      );
      continue;
    }

    const { valid, errors } = validate(parsed);
    if (!valid) {
      console.warn(
        `listAvailableThemes: skipping invalid theme file "${filePath}":`,
        errors,
      );
      continue;
    }

    const theme = parsed as { name: string; mode: "light" | "dark" | "both" };
    entries.push({
      name: theme.name,
      mode: theme.mode,
      builtin: false,
    });
  }

  return entries;
}

/**
 * Load a theme by name — checks builtins first, then scans the themes directory.
 * Returns the full ThemeConfig or undefined if not found / invalid.
 */
export function loadThemeByName(
  name: string,
  themesDir: string,
): ThemeConfig | undefined {
  // Check builtins first
  if (BUILTIN_THEMES[name]) {
    return BUILTIN_THEMES[name];
  }

  // Scan user themes directory
  if (!fs.existsSync(themesDir)) return undefined;

  let files: string[];
  try {
    files = fs.readdirSync(themesDir);
  } catch {
    return undefined;
  }

  for (const file of files) {
    if (!file.endsWith(".json")) continue;

    const filePath = path.join(themesDir, file);
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      const { valid } = validate(parsed);
      if (valid && parsed.name === name) {
        return parsed as ThemeConfig;
      }
    } catch {
      continue;
    }
  }

  return undefined;
}

/**
 * Delete a user-installed theme by name. Scans the themes directory for a
 * matching file and removes it. Returns true if a file was deleted.
 */
export function deleteThemeByName(
  name: string,
  themesDir: string,
): boolean {
  if (!fs.existsSync(themesDir)) return false;

  let files: string[];
  try {
    files = fs.readdirSync(themesDir);
  } catch {
    return false;
  }

  for (const file of files) {
    if (!file.endsWith(".json")) continue;

    const filePath = path.join(themesDir, file);
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed.name === name) {
        fs.unlinkSync(filePath);
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
}
