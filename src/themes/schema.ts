/**
 * Theme schema for Chronicles.
 *
 * A ThemeConfig describes a color palette that can be applied to the app.
 * Themes may target light mode, dark mode, or both. Required tokens must be
 * supplied by every theme. Derivable tokens are optional — if omitted, the
 * runtime falls back to the documented default.
 *
 * Color values may be expressed as:
 *   - Hex:              "#1a1a2e"
 *   - HSL function:     "hsl(222, 47%, 11%)"
 *   - HSL bare triple:  "222 47% 11%"
 *
 * Token names map directly to CSS custom properties. The camelCase field names
 * correspond to the CSS names without the leading "--" prefix, with hyphens
 * converted to camelCase. For example, `primaryForeground` → `--primary-foreground`.
 */

// ---------------------------------------------------------------------------
// Color token interfaces
// ---------------------------------------------------------------------------

/**
 * Required color tokens that every theme must supply.
 *
 * These map to the 22 CSS custom properties that are consumed by component
 * code and cannot be reliably derived from other values.
 */
export interface ThemeColorsRequired {
  /** Page / app background. CSS: --background */
  background: string;
  /** Default body text color. CSS: --foreground */
  foreground: string;
  /** High-contrast text variant (strong, code, hover states). CSS: --foreground-strong */
  foregroundStrong: string;
  /** Subtle background surfaces (sidebar items, inputs). CSS: --muted */
  muted: string;
  /** De-emphasized text (scrollbar thumb, code decorators). CSS: --muted-foreground */
  mutedForeground: string;
  /** Tooltip background. Intentionally inverted vs background. CSS: --tooltip */
  tooltip: string;
  /** Text on tooltip backgrounds. Intentionally inverted. CSS: --tooltip-foreground */
  tooltipForeground: string;
  /** Primary action color (buttons, prominent elements). CSS: --primary */
  primary: string;
  /** Text / icon on primary backgrounds. CSS: --primary-foreground */
  primaryForeground: string;
  /** Secondary surface color (sidesheets, secondary buttons). CSS: --secondary */
  secondary: string;
  /** Text on secondary surfaces. CSS: --secondary-foreground */
  secondaryForeground: string;
  /** Brand accent color. CSS: --accent */
  accent: string;
  /** Text on accent backgrounds. CSS: --accent-foreground */
  accentForeground: string;
  /** Lower-saturation accent for borders and hover states. CSS: --accent-muted */
  accentMuted: string;
  /** Hyperlink color. CSS: --link */
  link: string;
  /** Link hover state. CSS: --link-hover */
  linkHover: string;
  /** Danger / error state color. CSS: --destructive */
  destructive: string;
  /** Text on destructive backgrounds. CSS: --destructive-foreground */
  destructiveForeground: string;
  /** Default border color. CSS: --border */
  border: string;
  /** Focus ring color. CSS: --ring */
  ring: string;
  /** Tag chip background. CSS: --tag */
  tag: string;
  /** Text on tag chips. CSS: --tag-foreground */
  tagForeground: string;
}

/**
 * Optional (derivable) color tokens.
 *
 * If omitted, the runtime applies the documented default derivation rule.
 * Defaults are listed in JSDoc comments.
 */
export interface ThemeColorsDerivable {
  /** Card surface color. Default: same as `background`. CSS: --card */
  card?: string;
  /** Text on card surfaces. Default: same as `foreground`. CSS: --card-foreground */
  cardForeground?: string;
  /** Popover surface color. Default: same as `background`. CSS: --popover */
  popover?: string;
  /** Text in popovers. Default: same as `foreground`. CSS: --popover-foreground */
  popoverForeground?: string;
  /** Input field border / background. Default: same as `border`. CSS: --input */
  input?: string;
  /** Secondary accent variant. Default: same as `accent`. CSS: --accent-secondary */
  accentSecondary?: string;
  /** Text on secondary accent. Default: same as `accentForeground`. CSS: --accent-secondary-foreground */
  accentSecondaryForeground?: string;
  /** Tertiary accent variant. Default: same as `accent`. CSS: --accent-tertiary */
  accentTertiary?: string;
  /** Text on tertiary accent. Default: same as `accentForeground`. CSS: --accent-tertiary-foreground */
  accentTertiaryForeground?: string;
  /** Secondary tag chip background. Default: same as `secondary`. CSS: --tag-secondary */
  tagSecondary?: string;
  /** Text on secondary tag chips. Default: same as `secondaryForeground`. CSS: --tag-secondary-foreground */
  tagSecondaryForeground?: string;
}

/**
 * Full set of color tokens for a single mode (light or dark).
 */
export type ThemeColors = ThemeColorsRequired & ThemeColorsDerivable;

// ---------------------------------------------------------------------------
// Theme config
// ---------------------------------------------------------------------------

/**
 * Configuration for a Chronicles color theme.
 *
 * - `mode: 'light'` or `mode: 'dark'` — provide a single `colors` object.
 * - `mode: 'both'` — provide `colors.light` and `colors.dark` objects.
 */
export type ThemeConfig = ThemeSingleMode | ThemeBothModes;

export interface ThemeSingleMode {
  /** Human-readable theme name. */
  name: string;
  /** Semver version string (e.g. "1.0.0"). */
  version: string;
  /** The display mode this theme targets. */
  mode: "light" | "dark";
  /** Color tokens for the theme's single mode. */
  colors: ThemeColors;
}

export interface ThemeBothModes {
  /** Human-readable theme name. */
  name: string;
  /** Semver version string (e.g. "1.0.0"). */
  version: string;
  /** Indicates this theme supplies values for both light and dark modes. */
  mode: "both";
  /** Color tokens for both modes. */
  colors: {
    light: ThemeColors;
    dark: ThemeColors;
  };
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Canonical list of required token field names (camelCase).
 * Every ThemeColors object must supply all of these.
 */
export const REQUIRED_TOKENS: ReadonlyArray<keyof ThemeColorsRequired> = [
  "background",
  "foreground",
  "foregroundStrong",
  "muted",
  "mutedForeground",
  "tooltip",
  "tooltipForeground",
  "primary",
  "primaryForeground",
  "secondary",
  "secondaryForeground",
  "accent",
  "accentForeground",
  "accentMuted",
  "link",
  "linkHover",
  "destructive",
  "destructiveForeground",
  "border",
  "ring",
  "tag",
  "tagForeground",
];

/**
 * Derivable token field names (camelCase). These are optional and validated
 * only when present.
 */
export const DERIVABLE_TOKENS: ReadonlyArray<keyof ThemeColorsDerivable> = [
  "card",
  "cardForeground",
  "popover",
  "popoverForeground",
  "input",
  "accentSecondary",
  "accentSecondaryForeground",
  "accentTertiary",
  "accentTertiaryForeground",
  "tagSecondary",
  "tagSecondaryForeground",
];

/**
 * All known token field names — used to detect unexpected/unknown fields.
 */
const ALL_KNOWN_TOKENS = new Set<string>([
  ...REQUIRED_TOKENS,
  ...DERIVABLE_TOKENS,
]);

/**
 * Map from camelCase field name to the CSS custom property name, for use in
 * human-readable error messages and runtime application of CSS custom properties.
 */
export const CSS_NAME: Record<string, string> = {
  background: "--background",
  foreground: "--foreground",
  foregroundStrong: "--foreground-strong",
  muted: "--muted",
  mutedForeground: "--muted-foreground",
  tooltip: "--tooltip",
  tooltipForeground: "--tooltip-foreground",
  primary: "--primary",
  primaryForeground: "--primary-foreground",
  secondary: "--secondary",
  secondaryForeground: "--secondary-foreground",
  accent: "--accent",
  accentForeground: "--accent-foreground",
  accentMuted: "--accent-muted",
  link: "--link",
  linkHover: "--link-hover",
  destructive: "--destructive",
  destructiveForeground: "--destructive-foreground",
  border: "--border",
  ring: "--ring",
  tag: "--tag",
  tagForeground: "--tag-foreground",
  card: "--card",
  cardForeground: "--card-foreground",
  popover: "--popover",
  popoverForeground: "--popover-foreground",
  input: "--input",
  accentSecondary: "--accent-secondary",
  accentSecondaryForeground: "--accent-secondary-foreground",
  accentTertiary: "--accent-tertiary",
  accentTertiaryForeground: "--accent-tertiary-foreground",
  tagSecondary: "--tag-secondary",
  tagSecondaryForeground: "--tag-secondary-foreground",
};

/**
 * Pattern that matches a valid hex color: #rgb, #rgba, #rrggbb, #rrggbbaa.
 */
const HEX_RE = /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/**
 * Pattern that matches the HSL function form: hsl(H, S%, L%) or hsl(H S% L%).
 * Allows integers or decimals; the % on S and L is required.
 */
const HSL_FUNC_RE =
  /^hsl\(\s*[\d.]+\s*[,\s]\s*[\d.]+%\s*[,\s]\s*[\d.]+%\s*\)$/i;

/**
 * Pattern that matches the bare HSL triple form: "H S% L%" (space-separated,
 * used by CSS variables without the hsl() wrapper).
 */
const HSL_BARE_RE = /^[\d.]+\s+[\d.]+%\s+[\d.]+%$/;

/**
 * Returns true if `value` is a syntactically valid color string for Chronicle
 * themes (hex or HSL in either notation).
 */
function isValidColor(value: string): boolean {
  return (
    HEX_RE.test(value) || HSL_FUNC_RE.test(value) || HSL_BARE_RE.test(value)
  );
}

/**
 * Collects errors for a ThemeColors object.
 *
 * @param colors  The object to validate (may be unknown).
 * @param context A label such as `"colors"`, `"colors.light"`, or `"colors.dark"`
 *                prepended to error messages.
 * @param errors  Mutable array where errors are appended.
 */
function validateColors(
  colors: unknown,
  context: string,
  errors: string[],
): void {
  if (typeof colors !== "object" || colors === null || Array.isArray(colors)) {
    errors.push(`${context} must be an object`);
    // Cannot validate individual tokens without an object.
    return;
  }

  const obj = colors as Record<string, unknown>;

  // Check required tokens.
  for (const field of REQUIRED_TOKENS) {
    const cssName = CSS_NAME[field];
    const value = obj[field];

    if (value === undefined || value === null) {
      errors.push(
        `${context}: missing required token ${cssName} (field: "${field}")`,
      );
    } else if (typeof value !== "string") {
      errors.push(
        `${context}: token ${cssName} must be a string, got ${typeof value}`,
      );
    } else if (!isValidColor(value)) {
      errors.push(
        `${context}: invalid color value for ${cssName}: "${value}" ` +
          `(expected hex, e.g. "#1a1a2e", or HSL, e.g. "hsl(222, 47%, 11%)" or "222 47% 11%")`,
      );
    }
  }

  // Check optional/derivable tokens only when present.
  for (const field of DERIVABLE_TOKENS) {
    const value = obj[field];
    if (value === undefined || value === null) {
      // Omitted — will use derived default at runtime.
      continue;
    }
    const cssName = CSS_NAME[field];
    if (typeof value !== "string") {
      errors.push(
        `${context}: token ${cssName} must be a string, got ${typeof value}`,
      );
    } else if (!isValidColor(value)) {
      errors.push(
        `${context}: invalid color value for ${cssName}: "${value}" ` +
          `(expected hex, e.g. "#1a1a2e", or HSL, e.g. "hsl(222, 47%, 11%)" or "222 47% 11%")`,
      );
    }
  }

  // Warn about unknown fields (not treated as errors, but useful for authors).
  // We do nothing here — unknown fields are silently ignored to allow forward
  // compatibility (future schema additions won't break older validators).
}

// ---------------------------------------------------------------------------
// Public validation function
// ---------------------------------------------------------------------------

/**
 * Validates an unknown value against the ThemeConfig schema.
 *
 * All errors are collected before returning, so callers receive a full list of
 * problems rather than stopping at the first failure. This design is intentional:
 * it allows LLMs and human authors to fix all issues in one round.
 *
 * @param theme  An unknown value (typically parsed JSON).
 * @returns      `{ valid, errors }` — `valid` is true only when `errors` is empty.
 *
 * @example
 * const result = validate(JSON.parse(fs.readFileSync("my-theme.json", "utf8")));
 * if (!result.valid) {
 *   console.error("Theme errors:\n" + result.errors.join("\n"));
 * }
 */
export function validate(theme: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 1. Must be a plain object.
  if (typeof theme !== "object" || theme === null || Array.isArray(theme)) {
    errors.push("theme must be a non-null object");
    return { valid: false, errors };
  }

  const t = theme as Record<string, unknown>;

  // 2. name: non-empty string.
  if (!t.name || typeof t.name !== "string") {
    errors.push("theme.name must be a non-empty string");
  } else if (t.name.trim() === "") {
    errors.push("theme.name must not be blank");
  }

  // 3. version: string (basic semver-like format).
  if (typeof t.version !== "string") {
    errors.push("theme.version must be a string");
  } else if (!/^\d+\.\d+\.\d+/.test(t.version)) {
    errors.push(
      `theme.version must follow semver format (e.g. "1.0.0"), got: "${t.version}"`,
    );
  }

  // 4. mode: one of the allowed values.
  const VALID_MODES = ["light", "dark", "both"] as const;
  type ValidMode = (typeof VALID_MODES)[number];

  if (!t.mode || !VALID_MODES.includes(t.mode as ValidMode)) {
    errors.push(
      `theme.mode must be one of "light", "dark", or "both", got: ${JSON.stringify(t.mode)}`,
    );
    // Cannot validate colors structure without knowing the mode.
    return { valid: errors.length === 0, errors };
  }

  const mode = t.mode as ValidMode;

  // 5. colors: structure depends on mode.
  if (mode === "both") {
    // For 'both', colors must be { light: ThemeColors, dark: ThemeColors }.
    if (
      typeof t.colors !== "object" ||
      t.colors === null ||
      Array.isArray(t.colors)
    ) {
      errors.push(
        'theme.colors must be an object with "light" and "dark" keys when mode is "both"',
      );
    } else {
      const colors = t.colors as Record<string, unknown>;

      if (!("light" in colors)) {
        errors.push('theme.colors.light is required when mode is "both"');
      } else {
        validateColors(colors.light, "colors.light", errors);
      }

      if (!("dark" in colors)) {
        errors.push('theme.colors.dark is required when mode is "both"');
      } else {
        validateColors(colors.dark, "colors.dark", errors);
      }

      // Detect tokens accidentally placed at the top level of colors instead
      // of inside light/dark sub-objects.
      const topLevelTokenKeys = Object.keys(colors).filter(
        (k) => k !== "light" && k !== "dark" && ALL_KNOWN_TOKENS.has(k),
      );
      if (topLevelTokenKeys.length > 0) {
        errors.push(
          `theme.colors has token fields at the top level but mode is "both" — ` +
            `move them into colors.light and/or colors.dark: ${topLevelTokenKeys.join(", ")}`,
        );
      }
    }
  } else {
    // For 'light' or 'dark', colors must be a single ThemeColors object.
    if (
      typeof t.colors === "object" &&
      t.colors !== null &&
      !Array.isArray(t.colors)
    ) {
      const colors = t.colors as Record<string, unknown>;

      // Detect if the author accidentally nested light/dark sub-objects.
      const hasLightOrDark = "light" in colors || "dark" in colors;
      if (hasLightOrDark) {
        errors.push(
          `theme.colors should be a flat ThemeColors object when mode is "${mode}", ` +
            `but found "light" or "dark" sub-keys — use mode "both" if providing both variants`,
        );
      } else {
        validateColors(t.colors, "colors", errors);
      }
    } else {
      errors.push("theme.colors must be an object");
    }
  }

  return { valid: errors.length === 0, errors };
}
