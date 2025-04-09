import { ChevronLeftIcon, IconButton } from "evergreen-ui";
import { observer } from "mobx-react-lite";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { JournalResponse } from "../../../hooks/useClient";
import Titlebar from "../../../titlebar/macos";
import * as Base from "../../layout";
import { EditableDocument } from "../EditableDocument";
import { EditorMode } from "../EditorMode";
import { Separator } from "../editor/components/Separator";
import { MarkdownFrontMatter } from "./MarkdownFrontMatter";
import { MarkdownToolbar } from "./MarkdownToolbar";

interface Props {
  document: EditableDocument;
  selectedViewMode: EditorMode;
  setSelectedViewMode: (mode: EditorMode) => void;
  journals: JournalResponse[];
  goBack: () => void;
}

/**
 * A markdown editor that uses a simple textarea for editing the raw markdown content.
 * This provides a fallback mode for users to edit the underlying markdown directly.
 */
const MarkdownEditor = observer(
  ({
    document,
    selectedViewMode,
    setSelectedViewMode,
    journals,
    goBack,
  }: Props) => {
    // const focusEditor = useFocusEditor();
    const navigate = useNavigate();
    const [markdownContent, setMarkdownContent] = useState(document.content);

    // Update the local state when the document content changes
    useEffect(() => {
      setMarkdownContent(document.content);
    }, [document.content]);

    // Handle changes to the markdown content
    const handleMarkdownChange = (
      e: React.ChangeEvent<HTMLTextAreaElement>,
    ) => {
      const newContent = e.target.value;
      setMarkdownContent(newContent);
      document.setMarkdownContent(newContent);
    };

    return (
      <Base.EditorContainer>
        <Titlebar>
          <IconButton
            backgroundColor="transparent"
            border="none"
            icon={ChevronLeftIcon}
            className="drag-none"
            onClick={goBack}
            marginRight={8}
          >
            Back to documents
          </IconButton>
          <Separator orientation="vertical" />

          <MarkdownToolbar
            selectedEditorMode={selectedViewMode}
            setSelectedEditorMode={setSelectedViewMode}
            document={document}
          />
        </Titlebar>

        {/* This Ghost div is same height as titlebar, so pushes the main content below it -- necessary for the contents scrollbar to make sense */}
        <Base.TitlebarSpacer />
        <Base.ScrollContainer>
          <div className="flex w-full flex-grow flex-col">
            <MarkdownFrontMatter document={document} journals={journals} />

            <textarea
              placeholder="Write your markdown here..."
              className="flex w-full flex-grow bg-white font-mono text-sm focus:outline-none"
              value={markdownContent}
              onChange={handleMarkdownChange}
              spellCheck="true"
              autoFocus
            />
          </div>
        </Base.ScrollContainer>
      </Base.EditorContainer>
    );
  },
);

// p-4 pt-6  focus:ring-2 focus:ring-blue-500  border border-gray-200

export default MarkdownEditor;
