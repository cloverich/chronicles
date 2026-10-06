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
  "ready" | "getNotesClient" | "getSettings" | "getMaintenance"
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
