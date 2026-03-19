import type { ElectrobunRPCSchema } from "electrobun/bun";

// The modules on BunClient that are proxied to the renderer
export const CLIENT_MODULES = [
  "journals",
  "documents",
  "tags",
  "preferences",
  "files",
  "indexer",
  "importer",
  "bulkOperations",
] as const;

export type ClientModule = (typeof CLIENT_MODULES)[number];

export type ChroniclesRPC = ElectrobunRPCSchema & {
  bun: {
    requests: {
      /** Generic dispatch for any IClient sub-module method */
      clientCall: {
        params: { module: ClientModule; method: string; args: unknown[] };
        response: unknown;
      };
      openDialogSelectDir: {
        params?: undefined;
        response: { value?: string; error?: string };
      };
      selectThemeFile: {
        params?: undefined;
        response: { value?: string; error?: string };
      };
      importThemeFile: {
        params: { filePath: string; themesDir: string };
        response: { success: boolean; errors?: string[]; themeName?: string };
      };
      listAvailableThemes: {
        params: { themesDir: string };
        response: {
          themes: Array<{
            name: string;
            mode: string;
            inherentMode?: string;
            builtin: boolean;
            bundled: boolean;
          }>;
          overrides: string[];
        };
      };
      loadThemeByName: {
        params: { name: string; themesDir: string };
        response: unknown; // ThemeConfig | null
      };
      deleteThemeByName: {
        params: { name: string; themesDir: string };
        response: boolean;
      };
      listHljsThemes: {
        params?: undefined;
        response: string[];
      };
      loadHljsThemeCSS: {
        params: { name: string };
        response: string | null;
      };
      listInstalledFonts: {
        params?: undefined;
        response: string[];
      };
      getInstalledFontsStylesheetHref: {
        params?: undefined;
        response: string | null;
      };
      refreshInstalledFontsCache: {
        params?: undefined;
        response: { changed: boolean; css: string | null; href: string | null };
      };
      openPath: {
        params: { dirPath: string };
        response: void;
      };
      setNativeTheme: {
        params: { theme: "light" | "dark" | "system" };
        response: boolean;
      };
    };
    messages: {};
  };
  webview: {
    requests: {};
    messages: {};
  };
};
