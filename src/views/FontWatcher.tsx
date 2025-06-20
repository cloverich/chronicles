import { reaction } from "mobx";
import { observer } from "mobx-react-lite";
import React from "react";
import { Preferences } from "../hooks/stores/preferences";

interface Props {
  preferences: Preferences;
}

const DEFAULT_FONTS = {
  heading: '"Hubot Sans", "IBM Plex Mono", sans-serif',
  body: '"Mona Sans", sans-serif',
  mono: '"IBM Plex Mono", monospace',
};

export const FontWatcher: React.FC<Props> = observer(({ preferences }) => {
  React.useEffect(() => {
    return reaction(
      () => preferences.fonts,
      (fonts) => {
        const root = document.documentElement;

        // Apply font preferences to CSS variables
        if (fonts?.heading) {
          root.style.setProperty("--font-heading", fonts.heading);
        } else {
          root.style.setProperty("--font-heading", DEFAULT_FONTS.heading);
        }

        if (fonts?.heading2) {
          root.style.setProperty("--font-heading-2", fonts.heading2);
        } else {
          root.style.setProperty("--font-heading-2", `var(--font-heading)`);
        }

        if (fonts?.heading3) {
          root.style.setProperty("--font-heading-3", fonts.heading3);
        } else {
          root.style.setProperty("--font-heading-3", `var(--font-heading)`);
        }

        if (fonts?.body) {
          root.style.setProperty("--font-body", fonts.body);
        } else {
          root.style.setProperty("--font-body", DEFAULT_FONTS.body);
        }

        if (fonts?.mono) {
          root.style.setProperty("--font-mono", fonts.mono);
        } else {
          root.style.setProperty("--font-mono", DEFAULT_FONTS.mono);
        }
      },
      {
        fireImmediately: true, // Fire immediately to set the initial state
      },
    );
  }, []);

  return null;
});
