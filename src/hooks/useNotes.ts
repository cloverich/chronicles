import React, { useContext } from "react";
import type { NotesClient } from "../contract/notes";

/**
 * The injected NotesClient. Provided once at the app root (src/startup.tsx);
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

/** For components that degrade gracefully (e.g. editor plugins in isolation). */
export function useOptionalNotes(): NotesClient | null {
  return useContext(NotesContext);
}
