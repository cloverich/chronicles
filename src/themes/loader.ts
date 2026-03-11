import fs from "fs";
import path from "path";
import { BUILTIN_THEMES } from "./builtins";
import { BUNDLED_THEMES } from "./bundled";
import { ThemeConfig, validate } from "./schema";

export interface ThemeListEntry {
  name: string;
  mode: "light" | "dark" | "both";
  inherentMode?: "light" | "dark";
  builtin: boolean;
  bundled: boolean;
}

export interface ThemeListResult {
  themes: ThemeListEntry[];
  /** Names of bundled themes overridden by user-installed themes */
  overrides: string[];
}

/**
 * List all available themes: built-ins plus bundled JSON themes plus any
 * valid installed themes.
 *
 * 1. Starts with the built-in themes from BUILTIN_THEMES (System themes).
 * 2. Adds bundled themes from BUNDLED_THEMES (Built-in but JSON-based).
 * 3. Reads all `.json` files from `themesDir`.
 * 4. Parses and validates each file with `validate()`.
 * 5. Returns the combined list, skipping invalid files (logs a warning).
 * 6. If `themesDir` doesn't exist, returns only builtins and bundled.
 *
 * @param themesDir Absolute path to the user themes directory.
 */
export function listAvailableThemes(themesDir: string): ThemeListResult {
  const overrides: string[] = [];

  // 1. System built-ins
  const entries: ThemeListEntry[] = Object.values(BUILTIN_THEMES).map(
    (theme) => ({
      name: theme.name,
      mode: theme.mode,
      builtin: true,
      bundled: false,
    }),
  );

  // 2. Bundled JSON themes
  for (const theme of Object.values(BUNDLED_THEMES)) {
    entries.push({
      name: theme.name,
      mode: theme.mode,
      inherentMode: theme.inherentMode,
      builtin: false,
      bundled: true,
    });
  }

  if (!fs.existsSync(themesDir)) {
    return { themes: entries, overrides };
  }

  let files: string[];
  try {
    files = fs.readdirSync(themesDir);
  } catch (err) {
    console.warn(
      `listAvailableThemes: could not read themes directory "${themesDir}":`,
      err,
    );
    return { themes: entries, overrides };
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

    const theme = parsed as {
      name: string;
      mode: "light" | "dark" | "both";
      inherentMode?: "light" | "dark";
    };

    // User-installed theme with same name as a bundled theme: user wins
    const bundledIdx = entries.findIndex(
      (e) => e.bundled && e.name === theme.name,
    );
    if (bundledIdx !== -1) {
      overrides.push(theme.name);
      entries[bundledIdx] = {
        name: theme.name,
        mode: theme.mode,
        inherentMode: theme.inherentMode,
        builtin: false,
        bundled: false,
      };
    } else {
      entries.push({
        name: theme.name,
        mode: theme.mode,
        inherentMode: theme.inherentMode,
        builtin: false,
        bundled: false,
      });
    }
  }

  return { themes: entries, overrides };
}

/**
 * Load a theme by name — checks system builtins first, then user-installed
 * themes, then bundled JSON. User themes win over bundled themes of the
 * same name. Returns the full ThemeConfig or undefined if not found / invalid.
 */
export function loadThemeByName(
  name: string,
  themesDir: string,
): ThemeConfig | undefined {
  // Check system builtins first
  if (BUILTIN_THEMES[name]) {
    return BUILTIN_THEMES[name];
  }

  // Scan user themes directory (checked before bundled so user themes win)
  const userTheme = loadUserTheme(name, themesDir);
  if (userTheme) return userTheme;

  // Check bundled JSON themes
  if (BUNDLED_THEMES[name]) {
    return BUNDLED_THEMES[name];
  }

  return undefined;
}

function loadUserTheme(
  name: string,
  themesDir: string,
): ThemeConfig | undefined {
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
export function deleteThemeByName(name: string, themesDir: string): boolean {
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
