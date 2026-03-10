import { reaction, toJS } from "mobx";
import { observer } from "mobx-react-lite";
import React from "react";
import { Preferences } from "../hooks/stores/preferences";
import {
  resolveActiveThemeName,
  systemDarkTheme,
  systemLightTheme,
} from "../themes/builtins";
import {
  CSS_NAME,
  DERIVABLE_TOKENS,
  REQUIRED_TOKENS,
  ThemeColors,
} from "../themes/schema";

interface Props {
  preferences: Preferences;
}

/**
 * Derivation rules for optional color tokens: if a token is undefined, use the
 * value of the named fallback token from the resolved required colors.
 */
const DERIVABLE_DEFAULTS: Record<string, keyof ThemeColors> = {
  card: "background",
  cardForeground: "foreground",
  popover: "background",
  popoverForeground: "foreground",
  input: "border",
  accentSecondary: "accent",
  accentSecondaryForeground: "accentForeground",
  accentTertiary: "accent",
  accentTertiaryForeground: "accentForeground",
  tagSecondary: "secondary",
  tagSecondaryForeground: "secondaryForeground",
};

const HLJS_STYLE_ID = "chronicles-hljs-theme";
const DEFAULT_HLJS_LIGHT = "github";
const DEFAULT_HLJS_DARK = "github-dark";
const CUSTOM_FONT_LINK_ID = "chronicles-custom-fonts";

/**
 * Inject or replace the highlight.js theme CSS in a <style> tag.
 * The tag is identified by HLJS_STYLE_ID so it can be swapped on theme change.
 */
function applyHljsTheme(themeName: string): void {
  const css = window.chronicles.loadHljsThemeCSS(themeName);
  if (!css) {
    console.warn(`StyleWatcher: hljs theme "${themeName}" not found`);
    return;
  }

  let styleEl = document.getElementById(HLJS_STYLE_ID) as HTMLStyleElement;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = HLJS_STYLE_ID;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = css;
}

function applyCustomFontsStylesheet(href: string | null): void {
  let linkEl = document.getElementById(
    CUSTOM_FONT_LINK_ID,
  ) as HTMLLinkElement | null;

  if (!href) {
    linkEl?.remove();
    return;
  }

  if (!linkEl) {
    linkEl = document.createElement("link");
    linkEl.id = CUSTOM_FONT_LINK_ID;
    linkEl.rel = "stylesheet";
    document.head.appendChild(linkEl);
  }

  if (linkEl.href !== href) {
    linkEl.href = href;
  }
}

/**
 * Apply all theme color tokens as CSS custom properties on the document root.
 * Required tokens are applied directly; derivable tokens fall back to their
 * documented defaults when not explicitly set.
 */
function applyThemeColors(colors: ThemeColors): void {
  const root = document.documentElement;

  // Apply required tokens
  for (const token of REQUIRED_TOKENS) {
    const cssName = CSS_NAME[token];
    const value = colors[token];
    if (cssName && value) {
      root.style.setProperty(cssName, value);
    }
  }

  // Apply derivable tokens, falling back to defaults when undefined
  for (const token of DERIVABLE_TOKENS) {
    const cssName = CSS_NAME[token];
    if (!cssName) continue;

    const value = colors[token];
    if (value !== undefined) {
      root.style.setProperty(cssName, value);
    } else {
      // Apply the default derivation
      const fallbackKey = DERIVABLE_DEFAULTS[token];
      const fallbackValue = fallbackKey ? colors[fallbackKey] : undefined;
      if (fallbackValue) {
        root.style.setProperty(cssName, fallbackValue);
      }
    }
  }
}

/**
 * Watches preference changes and updates CSS custom properties on the document root.
 * Handles fonts, max-width, font-size, and color theme styling preferences.
 */
export const StyleWatcher: React.FC<Props> = observer(({ preferences }) => {
  React.useEffect(() => {
    const fontsDir = `${preferences.settingsDir}/fonts`;
    applyCustomFontsStylesheet(
      window.chronicles.getInstalledFontsStylesheetHref(fontsDir),
    );

    const refreshFontsCache = window.setTimeout(() => {
      const result = window.chronicles.refreshInstalledFontsCache(fontsDir);
      if (result.changed) {
        applyCustomFontsStylesheet(result.href);
        console.info(
          `StyleWatcher: refreshed custom font cache at "${fontsDir}"`,
        );
      }
    }, 0);

    // Watch font preferences
    const fontDisposer = reaction(
      () => toJS(preferences.fonts),
      (fonts) => {
        const root = document.documentElement;

        if (fonts.heading) {
          root.style.setProperty("--font-heading", fonts.heading);
        }

        if (fonts.title) {
          root.style.setProperty("--font-title", fonts.title);
        }

        if (fonts.heading2) {
          root.style.setProperty("--font-heading-2", fonts.heading2);
        }

        if (fonts.heading3) {
          root.style.setProperty("--font-heading-3", fonts.heading3);
        }

        if (fonts.body) {
          root.style.setProperty("--font-body", fonts.body);
        }

        if (fonts.mono) {
          root.style.setProperty("--font-mono", fonts.mono);
        }

        if (fonts.systemBody) {
          root.style.setProperty("--font-system-body", fonts.systemBody);
        }

        if (fonts.systemHeading) {
          root.style.setProperty("--font-system-heading", fonts.systemHeading);
        }

        if (fonts.searchBody) {
          root.style.setProperty("--font-search-body", fonts.searchBody);
        }
      },
      {
        fireImmediately: true,
      },
    );

    // Watch max-width preferences
    const maxWidthDisposer = reaction(
      () => toJS(preferences.maxWidth),
      (maxWidth) => {
        const root = document.documentElement;

        if (maxWidth.prose) {
          root.style.setProperty("--max-w-prose", maxWidth.prose);
        }

        if (maxWidth.code) {
          root.style.setProperty("--max-w-code", maxWidth.code);
        } else {
          root.style.setProperty("--max-w-code", "var(--max-w-prose)");
        }

        if (maxWidth.frontmatter) {
          root.style.setProperty("--max-w-frontmatter", maxWidth.frontmatter);
        } else {
          root.style.setProperty("--max-w-frontmatter", "var(--max-w-prose)");
        }
      },
      {
        fireImmediately: true,
      },
    );

    // Watch font-size preferences
    const fontSizeDisposer = reaction(
      () => toJS(preferences.fontSizes),
      (fontSizes) => {
        const root = document.documentElement;

        if (fontSizes?.search) {
          root.style.setProperty("--font-size-search", fontSizes.search);
        }

        if (fontSizes?.body) {
          root.style.setProperty("--font-size-body", fontSizes.body);
        }

        if (fontSizes?.heading) {
          root.style.setProperty("--font-size-heading", fontSizes.heading);
        }

        if (fontSizes?.title) {
          root.style.setProperty("--font-size-title", fontSizes.title);
        }
      },
      { fireImmediately: true },
    );

    /**
     * Resolve the effective color mode from preferences, applying OS preference
     * when darkMode is "system".
     */
    function resolveEffectiveMode(): "light" | "dark" {
      const darkMode = preferences.darkMode;
      if (darkMode === "system") {
        return window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      }
      return darkMode;
    }

    /**
     * Resolve and apply the active theme colors for the current effective mode.
     * Falls back to the built-in system theme if the selected theme is not found.
     */
    function applyActiveTheme(): void {
      const effectiveMode = resolveEffectiveMode();
      document.documentElement.classList.toggle(
        "dark",
        effectiveMode === "dark",
      );
      const themeName = resolveActiveThemeName(
        effectiveMode,
        preferences.themeLightName,
        preferences.themeDarkName,
      );

      const themesDir = `${preferences.settingsDir}/themes`;
      let theme = window.chronicles.loadThemeByName(themeName, themesDir);

      if (!theme) {
        console.error(
          `StyleWatcher: unknown theme "${themeName}", falling back to system default`,
        );
        theme = effectiveMode === "dark" ? systemDarkTheme : systemLightTheme;
      }

      let colors: ThemeColors;
      if (theme.mode === "both") {
        colors = theme.colors[effectiveMode];
      } else {
        colors = theme.colors;
      }

      applyThemeColors(colors);

      // Track in localStorage, so the initial app load (before React hydration) can use it
      localStorage.setItem("darkMode", preferences.darkMode);

      // Set native theme for Electron (scrollbars, menus, etc)
      // Use inherentMode if provided, otherwise fallback to the effective mode
      const nativeTheme = theme.inherentMode || effectiveMode;
      window.chronicles.setNativeTheme(nativeTheme);

      // Code syntax highlighting disabled until Plate's code_line collapse
      // bug is fixed — see https://github.com/cloverich/chronicles/issues/176
      // const codeTheme =
      //   effectiveMode === "dark"
      //     ? (preferences.codeThemeDark || DEFAULT_HLJS_DARK)
      //     : (preferences.codeThemeLight || DEFAULT_HLJS_LIGHT);
      // applyHljsTheme(codeTheme);
    }

    // Watch theme and darkMode preferences, apply colors immediately and on change
    const themeDisposer = reaction(
      () => ({
        darkMode: preferences.darkMode,
        themeLightName: preferences.themeLightName,
        themeDarkName: preferences.themeDarkName,
        // Uncomment when #176 is fixed:
        // codeThemeLight: preferences.codeThemeLight,
        // codeThemeDark: preferences.codeThemeDark,
      }),
      () => applyActiveTheme(),
      { fireImmediately: true },
    );

    // Also listen for OS-level dark mode changes when preference is "system"
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const osDarkModeHandler = () => {
      if (preferences.darkMode === "system") {
        applyActiveTheme();
      }
    };
    mql.addEventListener("change", osDarkModeHandler);

    // Cleanup all reactions and listeners
    return () => {
      window.clearTimeout(refreshFontsCache);
      fontDisposer();
      maxWidthDisposer();
      fontSizeDisposer();
      themeDisposer();
      mql.removeEventListener("change", osDarkModeHandler);
    };
  }, []);

  return null;
});
