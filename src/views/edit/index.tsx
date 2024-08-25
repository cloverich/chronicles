import React, { useContext, useState, useEffect } from "react";
import { observer } from "mobx-react-lite";
import Editor from "./editor";
import { IconButton, Pane, ChevronLeftIcon } from "evergreen-ui";
import { useEditableDocument } from "./useEditableDocument";
import { EditableDocument } from "./EditableDocument";
import { JournalResponse } from "../../preload/client/journals";
import { EditLoadingComponent } from "./loading";
import { JournalsStoreContext } from "../../hooks/useJournalsLoader";
import { useParams, useNavigate } from "react-router-dom";
import { useSearchStore } from "../documents/SearchStore";
import ReadOnlyTextEditor from "./editor/read-only-editor/ReadOnlyTextEditor";
import { EditorMode } from "./EditorMode";
import Titlebar from "../../titlebar/macos";
import PlateContainer from "./PlateContainer";
import { EditorToolbar } from "./editor/toolbar/EditorToolbar";
import FrontMatter from "./FrontMatter";
import { Separator } from "./editor/components/Separator";
import * as Base from "../layout";

// Loads document, with loading and error placeholders
const DocumentLoadingContainer = observer(() => {
  const journalsStore = useContext(JournalsStoreContext)!;
  const { document: documentId } = useParams();

  // todo: handle missing or invalid documentId; loadingError may be fine for this, but
  // haven't done any UX / design thinking around it.
  const {
    document,
    error: loadingError,
    loading,
  } = useEditableDocument(documentId!);

  // Filter journals to non-archived ones, but must also add
  // the current document's journal if its archived
  const [journals, setJournals] = useState<any>();

  useEffect(() => {
    if (!document) return;

    const journals = journalsStore.journals.filter((j) => {
      if (j.archivedAt) {
        return j.id === document.journalId;
      } else {
        return !j.archivedAt;
      }
    });

    setJournals(journals);
  }, [document, loadingError]);

  if (loadingError) {
    return <EditLoadingComponent error={loadingError} />;
  }

  // `loading` acts as a break when navigating from one document to another, effectively
  // resetting the state of the editor
  if (!document || !journals || loading) {
    return <EditLoadingComponent />;
  }

  return <DocumentEditView document={document} journals={journals} />;
});

interface DocumentEditProps {
  document: EditableDocument;
  journals: JournalResponse[];
}

/**
 * This is the main document editing view, which houses the editor and some controls.
 */
const DocumentEditView = observer((props: DocumentEditProps) => {
  const { document, journals } = props;
  const [selectedViewMode, setSelectedViewMode] = React.useState<EditorMode>(
    EditorMode.Editor,
  );
  const navigate = useNavigate();
  const searchStore = useSearchStore()!;

  function renderEditor(tab: string) {
    switch (tab) {
      case EditorMode.Editor:
        return <Editor />;
      case EditorMode.SlateDom:
        return (
          <ReadOnlyTextEditor
            selectedEditorMode={selectedViewMode}
            setSelectedEditorMode={setSelectedViewMode}
            json={document.slateContent}
          />
        );
      case EditorMode.Markdown:
        return (
          <ReadOnlyTextEditor
            selectedEditorMode={selectedViewMode}
            setSelectedEditorMode={setSelectedViewMode}
            markdown={document.content}
          />
        );
      case EditorMode.Mdast:
        return (
          <ReadOnlyTextEditor
            selectedEditorMode={selectedViewMode}
            setSelectedEditorMode={setSelectedViewMode}
            json={document.mdastDebug}
          />
        );
    }
  }

  function goBack() {
    if (
      !document.dirty ||
      confirm(
        "Document is unsaved, exiting will discard document. Stop editing anyways?",
      )
    ) {
      // This handles the edit case but hmm... if its new... it should be added to the search...
      // but in what order? Well... if we aren't paginated... it should be at the top.
      searchStore.updateSearch(document);
      navigate(-1);
    }
  }

  return (
    <PlateContainer
      document={document}
      journals={journals}
      saving={document.saving}
      value={document.slateContent}
      setValue={document.setSlateContent}
      selectedEditorMode={selectedViewMode}
      setSelectedEditorMode={setSelectedViewMode}
    >
      <Base.Container>
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

          <EditorToolbar
            selectedEditorMode={selectedViewMode}
            setSelectedEditorMode={setSelectedViewMode}
            document={document}
          />
        </Titlebar>

        {/* This Ghost div is same height as titlebar, so pushes the main content below it -- necessary for the contents scrollbar to make sense */}
        <Base.TitlebarSpacer />
        <Base.ScrollContainer>
          <Pane flexGrow={1} display="flex" flexDirection="column" width="100%">
            <FrontMatter document={document} journals={journals} />

            <Pane flexGrow={1} paddingTop={24}>
              {renderEditor(selectedViewMode)}
            </Pane>

            {/* Add padding to bottom of editor without disrupting the scrollbar on the parent */}
            <Base.BottomSpacer />
          </Pane>
        </Base.ScrollContainer>
      </Base.Container>
    </PlateContainer>
  );
});

export default DocumentLoadingContainer;
