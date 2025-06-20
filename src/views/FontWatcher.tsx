import { reaction } from "mobx";
import { observer } from "mobx-react-lite";
import React from "react";
import { Preferences } from "../hooks/stores/preferences";

interface Props {
  preferences: Preferences;
}

export const FontWatcher: React.FC<Props> = observer(({ preferences }) => {
  React.useEffect(() => {
    return reaction(
      () => preferences.fonts,
      (fonts) => {
        const root = document.documentElement;

        // Apply font preferences to CSS variables
        if (fonts.heading) {
          root.style.setProperty("--font-heading", fonts.heading);
        }

        if (fonts.heading2) {
          root.style.setProperty("--font-heading-2", fonts.heading2);
        }

        if (fonts.heading3) {
          root.style.setProperty("--font-heading-3", fonts.heading3);
        }

        if (fonts.body) {
          root.style.setProperty("--font-body", fonts.body);
        }

        if (fonts.mono) {
          root.style.setProperty("--font-mono", fonts.mono);
        }

        if (fonts.systemBody) {
          root.style.setProperty("--font-system-body", fonts.systemBody);
        }

        if (fonts.systemHeading) {
          root.style.setProperty("--font-system-heading", fonts.systemHeading);
        }
      },
      {
        fireImmediately: true, // Fire immediately to set the initial state
      },
    );
  }, []);

  return null;
});
