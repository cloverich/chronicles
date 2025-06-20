import { reaction } from "mobx";
import { observer } from "mobx-react-lite";
import React from "react";
import { Preferences } from "../hooks/stores/preferences";

interface Props {
  preferences: Preferences;
}

export const ThemeWatcher: React.FC<Props> = observer(({ preferences }) => {
  React.useEffect(() => {
    return reaction(
      () => preferences.darkMode,
      (darkMode) => {
        const resolved =
          darkMode === "system"
            ? window.matchMedia("(prefers-color-scheme: dark)").matches
              ? "dark"
              : "light"
            : darkMode;

        // Track in localStorage, so the initial app load (before React hydration) can use it
        // and the browser can persist it across sessions.
        localStorage.setItem("darkMode", darkMode);

        // Trigger a re-render when the darkMode changes
        document.documentElement.classList.remove("system", "light", "dark");
        document.documentElement.classList.add(resolved);
      },
      {
        fireImmediately: true, // Fire immediately to set the initial state
      },
    );
  }, []);

  React.useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      if (preferences.darkMode === "system") {
        const resolved = e.matches ? "dark" : "light";
        document.documentElement.classList.remove("system", "light", "dark");
        document.documentElement.classList.add(resolved);
      }
    };

    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return null;
});
