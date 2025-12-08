import { reaction, toJS } from "mobx";
import { observer } from "mobx-react-lite";
import React from "react";
import { Preferences } from "../hooks/stores/preferences";

interface Props {
  preferences: Preferences;
}

/**
 * Watches preference changes and updates CSS custom properties on the document root.
 * Handles fonts and max-width styling preferences.
 */
export const StyleWatcher: React.FC<Props> = observer(({ preferences }) => {
  React.useEffect(() => {
    // Watch font preferences
    const fontDisposer = reaction(
      () => toJS(preferences.fonts),
      (fonts) => {
        const root = document.documentElement;

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
        fireImmediately: true,
      },
    );

    // Watch max-width preferences
    const maxWidthDisposer = reaction(
      () => toJS(preferences.maxWidth),
      (maxWidth) => {
        const root = document.documentElement;

        if (maxWidth.prose) {
          root.style.setProperty("--max-w-prose", maxWidth.prose);
        }

        if (maxWidth.code) {
          root.style.setProperty("--max-w-code", maxWidth.code);
        } else {
          root.style.setProperty("--max-w-code", "var(--max-w-prose)");
        }
      },
      {
        fireImmediately: true,
      },
    );

    // Watch font-size preferences
    const fontSizeDisposer = reaction(
      () => toJS(preferences.fontSize),
      (fontSize) => {
        const root = document.documentElement;

        if (fontSize.noteTitle) {
          root.style.setProperty("--font-size-note-title", fontSize.noteTitle);
        }

        if (fontSize.noteBody) {
          root.style.setProperty("--font-size-note-body", fontSize.noteBody);
        }
      },
      {
        fireImmediately: true,
      },
    );

    // Cleanup all reactions
    return () => {
      fontDisposer();
      maxWidthDisposer();
      fontSizeDisposer();
    };
  }, []);

  return null;
});
