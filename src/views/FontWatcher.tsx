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
        if (fonts?.heading1) {
          root.style.setProperty("--font-heading-1", fonts.heading1);
        } else {
          root.style.setProperty("--font-heading-1", `var(--font-heading)`);
        }

        if (fonts?.heading2) {
          root.style.setProperty("--font-heading-2-custom", fonts.heading2);
        } else {
          root.style.setProperty(
            "--font-heading-2-custom",
            `var(--font-heading)`,
          );
        }

        if (fonts?.heading3) {
          root.style.setProperty("--font-heading-3-custom", fonts.heading3);
        } else {
          root.style.setProperty(
            "--font-heading-3-custom",
            `var(--font-heading)`,
          );
        }

        if (fonts?.systemBody) {
          root.style.setProperty("--font-system-body", fonts.systemBody);
        } else {
          root.style.setProperty("--font-system-body", `var(--font-body)`);
        }

        if (fonts?.systemHeading) {
          root.style.setProperty("--font-system-heading", fonts.systemHeading);
        } else {
          root.style.setProperty(
            "--font-system-heading",
            `var(--font-heading)`,
          );
        }

        if (fonts?.contentBody) {
          root.style.setProperty("--font-content-body", fonts.contentBody);
        } else {
          root.style.setProperty("--font-content-body", `var(--font-body)`);
        }

        if (fonts?.code) {
          root.style.setProperty("--font-code", fonts.code);
        } else {
          root.style.setProperty("--font-code", `var(--font-mono)`);
        }
      },
      {
        fireImmediately: true, // Fire immediately to set the initial state
      },
    );
  }, []);

  return null;
});
