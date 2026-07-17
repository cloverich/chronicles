import { observer } from "mobx-react-lite";
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import useClient, { JournalResponse } from "../../hooks/useClient";
import { useJournals } from "../../hooks/useJournals";
import { useSearchStore } from "../documents/SearchStore";
import { EditableDocument } from "./EditableDocument";
import EditorErrorBoundary from "./EditorErrorBoundary";
import { EditorMode } from "./EditorMode";
import { EditorLayout } from "./lexical/EditorLayout";
import { EditLoadingComponent } from "./loading";
import MarkdownEditor from "./markdown-editor";
import { useEditableDocument } from "./useEditableDocument";

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
  const client = useClient();

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

  async function deleteDocument() {
    if (!confirm("Are you sure you want to delete this note?")) return;
    await client.documents.del(document.id, document.journal);
    searchStore.updateSearch(document, "del");
    navigate("/documents");
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
        deleteDocument={deleteDocument}
      />
    </EditorErrorBoundary>
  );
});

function EditorInner({
  // todo: inject these into a store via context
  document,
  selectedViewMode,
  setSelectedViewMode,
  journals,
  goBack,
  deleteDocument,
}: {
  document: EditableDocument;
  selectedViewMode: EditorMode;
  setSelectedViewMode: (mode: EditorMode) => void;
  journals: JournalResponse[];
  goBack: () => void;
  deleteDocument: () => void;
}) {
  switch (selectedViewMode) {
    case EditorMode.Editor:
      return (
        <EditorLayout
          document={document}
          journals={journals}
          goBack={goBack}
          selectedViewMode={selectedViewMode}
          setSelectedViewMode={setSelectedViewMode}
          deleteDocument={deleteDocument}
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
          deleteDocument={deleteDocument}
        />
      );
  }
}

export default DocumentLoadingContainer;
