import * as React from "react";
import { ReadonlyToolbar } from "./ReadonlyToolbar";
import { observer } from "mobx-react-lite";
import { EditorMode } from "../../EditorMode";

interface Props {
  markdown?: string;
  /**
   * MDAST, Slate DOM, etc
   */
  json?: any;
  selectedEditorMode: EditorMode;
  setSelectedEditorMode: (s: EditorMode) => any;
}

/**
 * Really just a placeholder for a debug view, where we can inspect Slate DOM, MDAST, or raw markdown.
 * Could be expanded to be smarter about what and how its rendering.
 *
 */
const ReadOnlyTextEditor = observer(
  ({ markdown, json, selectedEditorMode, setSelectedEditorMode }: Props) => {
    function content() {
      if (json) {
        return <pre>{JSON.stringify(json, null, 2)}</pre>;
      } else {
        return <pre>{markdown}</pre>;
      }
    }

    return (
      <div>
        <ReadonlyToolbar
          selectedEditorMode={selectedEditorMode}
          setSelectedEditorMode={setSelectedEditorMode}
        />
        {content()}
      </div>
    );
  },
);

export default ReadOnlyTextEditor;
