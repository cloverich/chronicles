/**
 * Default values for all appearance-related preferences.
 * Shared between the settings store (electron-store defaults) and the
 * preferences UI (reset-to-defaults button).
 */
export const APPEARANCE_DEFAULTS = {
  darkMode: "system" as const,
  themeLightName: "System Light",
  themeDarkName: "System Dark",
  codeThemeLight: "github",
  codeThemeDark: "github-dark",
  fonts: {
    heading:
      '"Hubot Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
    heading2: undefined,
    heading3: undefined,
    title: undefined,
    body: '"Mona Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
    mono: '"IBM Plex Mono", ui-monospace, SFMono-Regular, "SF Mono", Monaco, Inconsolata, "Roboto Mono", "Noto Sans Mono", "Droid Sans Mono", "Courier New", monospace',
    systemBody:
      '"Mona Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
    systemHeading:
      '"Hubot Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
    searchBody: undefined,
  },
  fontSizes: {
    search: "16px",
    body: "1rem",
    heading: "1.5rem",
    title: "3rem",
  },
  maxWidth: {
    prose: "768px",
    code: undefined,
    frontmatter: undefined,
  },
};
