import { configure } from "mobx";
import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { Toaster } from "sonner";
import Container from "./container";
import { Preferences } from "./hooks/stores/preferences";
import { hostNotesClient, NotesContext } from "./hooks/useNotes";
import "./index.css";

// todo: refactor and enforce actions on mobx stores
configure({ enforceActions: "never" });

const root = createRoot(document.getElementById("app")!);

// The NotesClient is injected here, once. Without one the app can't run, so
// fail at startup with the reason instead of failing later on first use.
let notes: ReturnType<typeof hostNotesClient> | null = null;
let notesError: Error | null = null;
try {
  notes = hostNotesClient();
} catch (err) {
  notesError = err as Error;
}

// Rely on localStorage to ensure the last used dark mode setting is applied
// on launch. This avoids a flash of the wrong mode while the app stores
// initialize. See ThemeWatcher.
const theme = localStorage.getItem("darkMode") || "system";
document.documentElement.classList.add(theme);

root.render(
  <>
    <HashRouter>
      <Toaster
        theme={theme as Preferences["darkMode"]}
        duration={3000}
        position="bottom-right"
        style={
          {
            "--normal-bg": "var(--background)",
            "--normal-text": "var(--foreground)",
            "--normal-border": "var(--border)",
          } as React.CSSProperties
        }
        toastOptions={{
          classNames: {
            toast:
              "px-2 py-4 group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
            description: "group-[.toast]:text-muted-foreground",
            actionButton:
              "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
            cancelButton:
              "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          },
        }}
      />
      {notes ? (
        <NotesContext.Provider value={notes}>
          <Container />
        </NotesContext.Provider>
      ) : (
        <pre className="p-8 text-sm">{String(notesError)}</pre>
      )}
    </HashRouter>
  </>,
);
