import { useEditorRef } from "@udecode/plate/react";
import { observer } from "mobx-react-lite";
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ReactEditor } from "slate-react";
import { JournalResponse } from "../../hooks/useClient";
import { useJournals } from "../../hooks/useJournals";
import { useSearchStore } from "../documents/SearchStore";
import { EditableDocument } from "./EditableDocument";
import EditorErrorBoundary from "./EditorErrorBoundary";
import { EditorMode } from "./EditorMode";
import Editor from "./editor";
import { EditLoadingComponent } from "./loading";
import MarkdownEditor from "./markdown-editor";
import ReadOnlyTextEditor from "./read-only-editor";
import { useEditableDocument } from "./useEditableDocument";

/**
 * Helper for focusing the editor on click.
 *
 * Since the editor is styled to blend into the surrounding surfaces, some of which are just
 * spacers for layout, it can be confusing to know where to click to focus the editor. Adding this handler
 * onto the divs that should focus on click solves that. Note that, this hook MUST be used from components
 * wrapped by <PlateContainer> or they will error.
 */
export function useFocusEditor() {
  const editor = useEditorRef();
  return (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (e.target === e.currentTarget && !ReactEditor.isFocused(editor as any)) {
      ReactEditor.focus(editor as any);
    }
  };
}

// Loads document, with loading and error placeholders
const DocumentLoadingContainer = observer(() => {
  const journalsStore = useJournals();
  const { document: documentId } = useParams();

  const {
    document,
    error: loadingError,
    loading,
  } = useEditableDocument(documentId!);

  // Filter journals to non-archived ones, but must also add
  // the current document's journal if its archived
  const [journals, setJournals] = useState<any>();

  // Filter journals to non-archived ones, but must also add
  // the current document's journal if its archived
  useEffect(() => {
    if (!document) return;

    const journals = journalsStore.journals.filter((j) => {
      if (j.archived) {
        return j.name === document.journal;
      } else {
        return !j.archived;
      }
    });

    setJournals(journals);
  }, [document, loadingError]);

  if (loadingError) {
    return (
      <EditLoadingComponent
        journal={document?.journal}
        documentId={documentId}
        error={loadingError}
      />
    );
  }

  // `loading` acts as a break when navigating from one document to another, effectively
  // resetting the state of the editor
  if (!document || !journals || loading) {
    return (
      <EditLoadingComponent
        journal={document?.journal}
        documentId={documentId}
      />
    );
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

  // If there are no journals, redirect to the documents view
  React.useEffect(() => {
    if (!journals?.length) {
      navigate("/documents");
    }
  }, []);

  function goBack() {
    if (
      !document.saving ||
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
    <EditorErrorBoundary
      documentId={document.id}
      journal={document.journal}
      navigate={navigate}
    >
      <EditorInner
        document={document}
        selectedViewMode={selectedViewMode}
        setSelectedViewMode={setSelectedViewMode}
        journals={journals}
        goBack={goBack}
      />
    </EditorErrorBoundary>
  );
});

// Moved from Container to support using useFocusEditor, which requires
// component being wrapped in PlateContainer
function EditorInner({
  // todo: inject these into a store via context
  document,
  selectedViewMode,
  setSelectedViewMode,
  journals,
  goBack,
}: {
  document: EditableDocument;
  selectedViewMode: EditorMode;
  setSelectedViewMode: (mode: EditorMode) => void;
  journals: JournalResponse[];
  goBack: () => void;
}) {
  switch (selectedViewMode) {
    case EditorMode.Editor:
      return (
        <Editor
          document={document}
          journals={journals}
          goBack={goBack}
          selectedViewMode={selectedViewMode}
          setSelectedViewMode={setSelectedViewMode}
        />
      );
    case EditorMode.Markdown:
      return (
        <MarkdownEditor
          document={document}
          journals={journals}
          goBack={goBack}
          selectedViewMode={selectedViewMode}
          setSelectedViewMode={setSelectedViewMode}
        />
      );
    case EditorMode.SlateDom:
      return (
        <ReadOnlyTextEditor
          goBack={goBack}
          json={document.getInitialSlateContent()}
          selectedEditorMode={selectedViewMode}
          setSelectedEditorMode={setSelectedViewMode}
        />
      );
    case EditorMode.Mdast:
      return (
        <ReadOnlyTextEditor
          goBack={goBack}
          selectedEditorMode={selectedViewMode}
          setSelectedEditorMode={setSelectedViewMode}
          json={document.mdastDebug}
        />
      );
  }
}

export default DocumentLoadingContainer;
