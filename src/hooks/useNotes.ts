import React, { useContext } from "react";
import type { NotesClient } from "../contract/notes";
import { hydrateNotesClient } from "../contract/transport";

/**
 * The injected NotesClient. Provided once at the app root (src/index.tsx);
 * tests provide the in-memory reference adapter. There is no default: a
 * missing provider is a programming error, not a silent fallback.
 */
export const NotesContext = React.createContext<NotesClient | null>(null);
NotesContext.displayName = "NotesContext";

export function useNotes(): NotesClient {
  const notes = useContext(NotesContext);
  if (!notes) {
    throw new Error("[chronicles] useNotes() called outside a NotesContext");
  }
  return notes;
}

/** The host's NotesClient, or an error explaining why there is none. */
export function hostNotesClient(): NotesClient {
  const raw = window.chronicles?.getNotesClient?.();
  if (!raw) {
    throw new Error(
      "[chronicles] No NotesClient: the host did not provide window.chronicles.getNotesClient",
    );
  }
  return hydrateNotesClient(raw);
}

/** For components that degrade gracefully (e.g. editor plugins in isolation). */
export function useOptionalNotes(): NotesClient | null {
  return useContext(NotesContext);
}
