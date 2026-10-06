import React, { useContext } from "react";

/**
 * Host capabilities that aren't notes, settings, or maintenance: dialogs,
 * reveal-in-Finder, native appearance, and theme/font/code-theme files. Electron provides
 * them through the preload; the app root injects them here so views never
 * read `window.chronicles` directly. A host without a capability should
 * reject with an `unsupported` NotesError rather than no-op.
 */
export type PlatformServices = Omit<
  Window["chronicles"],
  "ready" | "getClient" | "getNotesClient" | "getSettings" | "getMaintenance"
>;

export const PlatformContext = React.createContext<PlatformServices | null>(
  null,
);
PlatformContext.displayName = "PlatformContext";

export function usePlatform(): PlatformServices {
  const platform = useContext(PlatformContext);
  if (!platform) {
    throw new Error(
      "[chronicles] usePlatform() called outside a PlatformContext",
    );
  }
  return platform;
}

/** The Electron host's platform services. */
export function hostPlatformServices(): PlatformServices {
  if (!window.chronicles) {
    throw new Error(
      "[chronicles] No platform services: window.chronicles is missing",
    );
  }
  const {
    ready: _r,
    getClient: _c,
    getNotesClient: _n,
    getSettings: _s,
    getMaintenance: _m,
    ...platform
  } = window.chronicles;
  return platform;
}
