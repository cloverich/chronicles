import ariakeDark from "./bundled/ariake-dark.theme.json";
import hearthside from "./bundled/hearthside.theme.json";
import kayb from "./bundled/kayb.theme.json";
import neofloss from "./bundled/neofloss.theme.json";
import nord from "./bundled/nord.theme.json";
import { ThemeConfig } from "./schema";

/**
 * Themes that are bundled with the app as JSON files.
 * These are NOT the core "System" themes, but are available by default.
 */
export const BUNDLED_THEMES: Record<string, ThemeConfig> = {
  [ariakeDark.name]: ariakeDark as ThemeConfig,
  [hearthside.name]: hearthside as ThemeConfig,
  [kayb.name]: kayb as ThemeConfig,
  [neofloss.name]: neofloss as ThemeConfig,
  [nord.name]: nord as ThemeConfig,
};
