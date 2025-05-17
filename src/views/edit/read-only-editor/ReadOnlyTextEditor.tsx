import { observer } from "mobx-react-lite";
import * as React from "react";
import { IconButton } from "../../../components/IconButton";
import Titlebar from "../../../titlebar/macos";
import * as Base from "../../layout";
import { EditorMode } from "../EditorMode";
import { Separator } from "../editor/components/Separator";
import { ReadonlyToolbar } from "./ReadonlyToolbar";

interface Props {
  markdown?: string;
  /**
   * MDAST, Slate DOM, etc
   */
  json?: any;
  selectedEditorMode: EditorMode;
  setSelectedEditorMode: (s: EditorMode) => any;
  goBack: () => void;
}

/**
 * Really just a placeholder for a debug view, where we can inspect Slate DOM, MDAST, or raw markdown.
 * Could be expanded to be smarter about what and how its rendering.
 */
export const ReadOnlyTextEditor = observer(
  ({
    markdown,
    json,
    selectedEditorMode,
    setSelectedEditorMode,
    goBack,
  }: Props) => {
    function content() {
      if (json) {
        return <pre>{JSON.stringify(json, null, 2)}</pre>;
      } else {
        return <pre>{markdown}</pre>;
      }
    }

    return (
      <Base.EditorContainer>
        <Titlebar>
          <IconButton
            aria-label="Back to documents"
            icon="chevron-left"
            className="mr-4 drag-none"
            onClick={goBack}
          />
          <Separator orientation="vertical" />

          <ReadonlyToolbar
            selectedEditorMode={selectedEditorMode}
            setSelectedEditorMode={setSelectedEditorMode}
          />
        </Titlebar>

        {/* This Ghost div is same height as titlebar, so pushes the main content below it -- necessary for the contents scrollbar to make sense */}
        <Base.TitlebarSpacer />
        <Base.ScrollContainer>
          <div className="flex w-full flex-grow flex-col">
            <div className="flex flex-grow pt-6">
              <div>{content()}</div>
            </div>

            {/* Add padding to bottom of editor without disrupting the scrollbar on the parent */}
            <Base.BottomSpacer />
          </div>
        </Base.ScrollContainer>
      </Base.EditorContainer>
    );
  },
);
