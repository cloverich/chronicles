import ariakeDark from "./bundled/ariake-dark.theme.json";
import kaybDark from "./bundled/kayb-dark.theme.json";
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
  [kayb.name]: kayb as ThemeConfig,
  [kaybDark.name]: kaybDark as ThemeConfig,
  [neofloss.name]: neofloss as ThemeConfig,
  [nord.name]: nord as ThemeConfig,
};
