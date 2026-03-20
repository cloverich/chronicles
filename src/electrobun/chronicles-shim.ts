/**
 * Webview-side shim that implements window.chronicles by proxying
 * all calls through Electrobun RPC.
 *
 * The key trick: getClient() returns a Proxy-based IClient where
 * each sub-module (journals, documents, etc.) is itself a Proxy
 * that turns method calls into RPC requests.
 */

// This is plain JS that receives the RPC object — no electrobun/view imports.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function installChroniclesShim(rpc: any) {
  const CLIENT_MODULES = [
    "journals",
    "documents",
    "tags",
    "preferences",
    "files",
    "indexer",
    "importer",
    "bulkOperations",
  ];

  // Create a proxy for a single module (e.g., client.journals)
  function createModuleProxy(moduleName: string) {
    return new Proxy(
      {},
      {
        get(_target, method: string) {
          if (method === "then") return undefined; // Prevent auto-thenable detection
          return async (...args: unknown[]) => {
            return rpc.request.clientCall({
              module: moduleName,
              method,
              args,
            });
          };
        },
      },
    );
  }

  // Create the IClient proxy
  function createClientProxy() {
    const modules: Record<string, unknown> = {};
    for (const mod of CLIENT_MODULES) {
      modules[mod] = createModuleProxy(mod);
    }
    return new Proxy(modules, {
      get(target, prop: string) {
        if (prop in target) return target[prop];
        // For properties like 'knex' or 'db' that don't exist in proxy mode
        return undefined;
      },
    });
  }

  let cachedClient: unknown = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).chronicles = {
    getClient: () => {
      if (!cachedClient) cachedClient = createClientProxy();
      return cachedClient;
    },
    openDialogSelectDir: () => rpc.request.openDialogSelectDir(),
    selectThemeFile: () => rpc.request.selectThemeFile(),
    importThemeFile: (filePath: string, themesDir: string) =>
      rpc.request.importThemeFile({ filePath, themesDir }),
    listAvailableThemes: (themesDir: string) =>
      rpc.request.listAvailableThemes({ themesDir }),
    loadThemeByName: (name: string, themesDir: string) =>
      rpc.request.loadThemeByName({ name, themesDir }),
    deleteThemeByName: (name: string, themesDir: string) =>
      rpc.request.deleteThemeByName({ name, themesDir }),
    listHljsThemes: () => rpc.request.listHljsThemes(),
    loadHljsThemeCSS: (name: string) => rpc.request.loadHljsThemeCSS({ name }),
    listInstalledFonts: () => rpc.request.listInstalledFonts(),
    getInstalledFontsStylesheetHref: () =>
      rpc.request.getInstalledFontsStylesheetHref(),
    refreshInstalledFontsCache: () => rpc.request.refreshInstalledFontsCache(),
    openPath: (dirPath: string) => rpc.request.openPath({ dirPath }),
    setNativeTheme: (theme: "light" | "dark" | "system") =>
      rpc.request.setNativeTheme({ theme }),
  };

  // Context menu — right-click triggers native menu via RPC
  document.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    rpc.send.showContextMenu({ x: e.clientX, y: e.clientY });
  });
}
