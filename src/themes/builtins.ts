/**
 * Built-in system themes for Chronicles.
 *
 * These themes express the hardcoded color values from src/index.css as valid
 * ThemeConfig objects. The HSL values match exactly what is in the CSS.
 *
 * Note: The light theme (:root in index.css) is missing some tokens that only
 * appear in the .dark selector (foregroundStrong, link, linkHover, accentMuted).
 * Reasonable values have been chosen for these in the light theme:
 *   - foregroundStrong: slightly darker than foreground
 *   - link / linkHover: a standard blue
 *   - accentMuted: a muted version of the accent color
 */
import { ThemeConfig } from "./schema";

export const systemLightTheme: ThemeConfig = {
  name: "System Light",
  version: "1.0.0",
  mode: "light",
  colors: {
    // --- Required tokens ---
    background: "hsl(0 0% 100%)",
    foreground: "hsl(222.2 84% 4.9%)",
    // Not in :root; slightly darker than foreground for strong emphasis
    foregroundStrong: "hsl(222.2 84% 3%)",
    muted: "hsl(210 40% 96.1%)",
    mutedForeground: "hsl(215.4 16.3% 46.9%)",
    tooltip: "hsl(222.2 84% 4.9%)",
    tooltipForeground: "hsl(0 0% 100%)",
    primary: "hsl(222.2 47.4% 11.2%)",
    primaryForeground: "hsl(210 40% 98%)",
    secondary: "hsl(210 40% 96.1%)",
    secondaryForeground: "hsl(222.2 47.4% 11.2%)",
    accent: "hsl(173 80% 40%)",
    accentForeground: "hsl(180 1% 19%)",
    // Not in :root; muted version of the accent color
    accentMuted: "hsl(173 40% 60%)",
    // Not in :root; standard blue link colors for light mode
    link: "hsl(224 100% 40%)",
    linkHover: "hsl(224 100% 30%)",
    destructive: "hsl(0 72.22% 50.59%)",
    destructiveForeground: "hsl(210 40% 98%)",
    border: "hsl(214.3 31.8% 91.4%)",
    ring: "hsl(215 20.2% 65.1%)",
    tag: "hsl(257 8% 83%)",
    tagForeground: "hsl(210 3% 15%)",

    // --- Derivable tokens ---
    card: "hsl(0 0% 100%)",
    cardForeground: "hsl(222.2 84% 4.9%)",
    popover: "hsl(0 0% 100%)",
    popoverForeground: "hsl(222.2 84% 4.9%)",
    input: "hsl(214.3 31.8% 91.4%)",
    accentSecondary: "hsl(173 80% 40%)",
    accentSecondaryForeground: "hsl(168 83% 89%)",
    accentTertiary: "hsl(173 80% 40%)",
    accentTertiaryForeground: "hsl(168 83% 89%)",
    tagSecondary: "hsl(217.2 32.6% 17.5%)",
    tagSecondaryForeground: "hsl(210 40% 98%)",
  },
};

export const systemDarkTheme: ThemeConfig = {
  name: "System Dark",
  version: "1.0.0",
  mode: "dark",
  colors: {
    // --- Required tokens ---
    background: "hsl(222.2 84% 4.9%)",
    foreground: "hsl(254 35% 78%)",
    foregroundStrong: "hsl(224 100% 72%)",
    muted: "hsl(217.2 32.6% 20%)",
    mutedForeground: "hsl(215 20.2% 65.1%)",
    tooltip: "hsl(222.2 84% 4.9%)",
    tooltipForeground: "hsl(210 40% 98%)",
    primary: "hsl(254 35% 78%)",
    primaryForeground: "hsl(217.2 32.6% 17.5%)",
    secondary: "hsl(217.2 32.6% 17.5%)",
    secondaryForeground: "hsl(210 40% 98%)",
    accent: "hsl(173 80% 40%)",
    accentForeground: "hsl(168 83% 89%)",
    accentMuted: "hsl(224 40% 40%)",
    link: "hsl(224 100% 78%)",
    linkHover: "hsl(224 100% 72%)",
    destructive: "hsl(350 70% 45%)",
    destructiveForeground: "hsl(0 80% 90%)",
    border: "hsl(217.2 32.6% 17.5%)",
    ring: "hsl(217.2 32.6% 17.5%)",
    tag: "hsl(234 35% 44%)",
    tagForeground: "hsl(210 40% 98%)",

    // --- Derivable tokens ---
    card: "hsl(222.2 84% 4.9%)",
    cardForeground: "hsl(210 40% 98%)",
    popover: "hsl(222.2 84% 4.9%)",
    popoverForeground: "hsl(210 40% 98%)",
    input: "hsl(217.2 32.6% 17.5%)",
    accentSecondary: "hsl(173 80% 40%)",
    accentSecondaryForeground: "hsl(168 83% 89%)",
    accentTertiary: "hsl(173 80% 40%)",
    accentTertiaryForeground: "hsl(168 83% 89%)",
    tagSecondary: "hsl(217.2 32.6% 17.5%)",
    tagSecondaryForeground: "hsl(210 40% 98%)",
  },
};

/**
 * Map of built-in theme names to their ThemeConfig objects.
 * Used to resolve themes by name without reading from disk.
 */
export const BUILTIN_THEMES: Record<string, ThemeConfig> = {
  [systemLightTheme.name]: systemLightTheme,
  [systemDarkTheme.name]: systemDarkTheme,
};

/**
 * Resolve the active theme by name from the built-in themes registry.
 *
 * Returns the ThemeConfig for the given name, or undefined if the name is not
 * found among the built-in themes. In a future issue (#447), this will be
 * extended to also search user-installed themes from the themes directory.
 *
 * @param name - Theme name to look up (e.g. "System Light", "System Dark")
 */
export function resolveBuiltinTheme(name: string): ThemeConfig | undefined {
  return BUILTIN_THEMES[name];
}

/**
 * Determine which theme name to use based on the current dark mode preference.
 *
 * When darkMode is "system", the OS-level preference is not resolved here —
 * the caller is responsible for determining the effective mode and passing
 * either "light" or "dark".
 *
 * @param effectiveMode - The resolved display mode: "light" or "dark"
 * @param themeLightName - Name of the theme selected for light mode
 * @param themeDarkName - Name of the theme selected for dark mode
 * @returns The theme name that should be active
 */
export function resolveActiveThemeName(
  effectiveMode: "light" | "dark",
  themeLightName: string,
  themeDarkName: string,
): string {
  return effectiveMode === "dark" ? themeDarkName : themeLightName;
}
