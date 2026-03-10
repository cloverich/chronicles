import neofloss from "./bundled/neofloss.theme.json";
import warmPaper from "./bundled/warm-paper.theme.json";
import { ThemeConfig } from "./schema";

/**
 * Themes that are bundled with the app as JSON files.
 * These are NOT the core "System" themes, but are available by default.
 */
export const BUNDLED_THEMES: Record<string, ThemeConfig> = {
  [warmPaper.name]: warmPaper as ThemeConfig,
  [neofloss.name]: neofloss as ThemeConfig,
};
