import React, { useContext, useState, useEffect } from "react";
import { observer } from "mobx-react-lite";
import Editor from "./editor";
import {
  Pane,
  Button,
  Popover,
  Menu,
  Position,
  Tab,
  Tablist,
  TagInput,
} from "evergreen-ui";
import { useEditableDocument } from "./useEditableDocument";
import { EditableDocument } from "./EditableDocument";
import { css } from "emotion";
import { JournalResponse } from "../../preload/client/journals";
import { EditLoadingComponent } from "./loading";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { useIsMounted } from "../../hooks/useIsMounted";
import { JournalsStoreContext } from "../../hooks/useJournalsLoader";
import { useParams, useNavigate } from "react-router-dom";
import { SearchStoreContext } from "../documents/SearchStore";

// Loads document, with loading and error placeholders
function DocumentLoadingContainer() {
  const journalsStore = useContext(JournalsStoreContext);
  const searchStore = useContext(SearchStoreContext);
  const { document: documentId } = useParams();

  const { document, loadingError } = useEditableDocument(
    searchStore,
    journalsStore,
    documentId,
  );

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

  if (!document || !journals) {
    return <EditLoadingComponent />;
  }

  return <DocumentEditView document={document} journals={journals} />;
}

interface DocumentEditProps {
  document: EditableDocument;
  journals: JournalResponse[];
}

import ReadOnlyTextEditor from "./editor/read-only-editor/ReadOnlyTextEditor";
import { EditorMode } from "./EditorMode";
import { TagTokenParser } from "../documents/search/parsers/tag";
import { Icons } from "../../components/icons";

/**
 * This is the main document editing view, which houses the editor and some controls.
 */
const DocumentEditView = observer((props: DocumentEditProps) => {
  const { document, journals } = props;
  const isMounted = useIsMounted();
  const navigate = useNavigate();
  const [selectedViewMode, setSelectedViewMode] = React.useState<EditorMode>(
    EditorMode.Editor,
  );

  // Autofocus the heading input
  const onInputRendered = React.useCallback(
    (inputElement: HTMLInputElement) => {
      if (inputElement) {
        // After experimenting, unsure why the delay is helpful.
        // https://blog.maisie.ink/react-ref-autofocus/
        setTimeout(() => inputElement.focus(), 200);
        inputElement.focus();
      }
    },
    [],
  );

  // todo: move this to view model
  function getName(journalId?: string) {
    const journal = journals?.find((j) => j.id === journalId);
    return journal ? journal.name : "Unknown journal";
  }

  function makeOptions(close: any) {
    return journals.map((j: any) => {
      return (
        <Menu.Item
          key={j.id}
          onSelect={(e) => {
            document.journalId = j.id;
            close();
          }}
        >
          {j.name}
        </Menu.Item>
      );
    });
  }

  function journalPicker() {
    return (
      <Popover
        position={Position.BOTTOM}
        content={({ close }) => (
          <div
            className={css`
              max-height: 400px;
              overflow: auto;
            `}
          >
            <Menu>
              <Menu.Group>{makeOptions(close)}</Menu.Group>
            </Menu>
          </div>
        )}
      >
        <span
          className={css`
            border-bottom: 1px solid #8d8d8d;
            cursor: pointer;
          `}
        >
          {getName(document.journalId)}
        </span>
      </Popover>
    );
  }

  function onDayPick(day: Date, callback: () => void) {
    document.createdAt = day.toISOString();
    callback();
  }

  // tests: when changing date, documents date is highlighted
  // when changing date, currently selected date's month is the active one
  // document auto-saves when changing date
  function datePicker() {
    return (
      <Popover
        position={Position.BOTTOM}
        content={({ close }) => (
          <div
            className={css`
              max-height: 400px;
              overflow: auto;
            `}
          >
            <DayPicker
              selected={new Date(document.createdAt)}
              defaultMonth={new Date(document.createdAt)}
              onDayClick={(day) => onDayPick(day, close)}
              mode="single"
            />
          </div>
        )}
      >
        <span
          className={css`
            border-bottom: 1px solid #8d8d8d;
            cursor: pointer;
          `}
        >
          {document.createdAt.slice(0, 10)}
        </span>
      </Popover>
    );
  }

  function goBack() {
    if (
      !document.dirty ||
      confirm(
        "Document is unsaved, exiting will discard document. Stop editing anyways?",
      )
    ) {
      navigate(-1);
    }
  }

  async function deleteDocument() {
    if (!document.canDelete) return;
    if (confirm("Are you sure?")) {
      await document.del();
      if (isMounted()) navigate(-1);
    }
  }

  function onAddTag(tokens: string[]) {
    if (tokens.length > 1) {
      // https://evergreen.segment.com/components/tag-input
      // Documents say this is single value, Type says array
      // Testing says array but with only one value... unsure how multiple
      // values end up in the array.
      console.warn(
        "TagInput.onAdd called with > 1 token? ",
        tokens,
        "ignoring extra tokens",
      );
    }

    let tag = new TagTokenParser().parse(tokens[0])?.value;
    if (!tag) return;

    if (!document.tags.includes(tag)) {
      document.tags.push(tag);
      document.save();
    }
  }

  function onRemoveTag(tag: string | React.ReactNode, idx: number) {
    if (typeof tag !== "string") return;
    document.tags = document.tags.filter((t) => t !== tag);
    document.save();
  }

  function renderTab(tab: string) {
    switch (tab) {
      case EditorMode.Editor:
        return (
          <Pane>
            <Editor
              saving={document.saving}
              value={document.slateContent}
              setValue={document.setSlateContent}
              selectedEditorMode={selectedViewMode}
              setSelectedEditorMode={setSelectedViewMode}
            />
          </Pane>
        );
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

  // flexGrows are needed so save / edit buttons are at bottom on both empty documents
  // and scrollable documents
  return (
    <Pane flexGrow={1} display="flex" flexDirection="column">
      <div style={{ marginBottom: "24px" }}>
        <a
          onClick={goBack}
          className={css`
            cursor: pointer;
          `}
        >
          Back
        </a>
      </div>

      <div>
        <input
          type="text"
          name="title"
          ref={onInputRendered}
          className={css`
            font-size: 1.8em;
            border: none;
            width: 100%;
            &:focus {
              outline: none;
            }
          `}
          onChange={(e: any) => (document.title = e.target.value)}
          value={document.title || ""} // OR '' prevents react complaining about uncontrolled component
          placeholder="Untitled document"
        />
      </div>
      <div
        className={css`
          display: flex;
          justify-content: flex-start;
          padding-left: 2px;
          font-size: 0.9rem;
          margin-top: -4px;
          margin-bottom: 16px;
        `}
      >
        {datePicker()}
        &nbsp;in&nbsp;
        {journalPicker()}
      </div>

      <div
        className={css`
          display: flex;
          justify-content: flex-start;
          padding-left: 2px;
          font-size: 0.9rem;
          margin-top: -4px;
          margin-bottom: 16px;
        `}
      >
        <TagInput
          flexGrow={1}
          inputProps={{ placeholder: "Document tags" }}
          values={document.tags}
          onAdd={onAddTag}
          onRemove={onRemoveTag}
        />
      </div>

      <Pane flexGrow={1}>{renderTab(selectedViewMode)}</Pane>

      {/* Action buttons */}
      <Pane marginTop={24} display="flex" justifyContent="flex-end">
        <Button
          onClick={() => document.save()}
          disabled={!document.dirty}
          isLoading={document.saving}
        >
          {document.saving ? "Saving" : document.dirty ? "Save" : "Saved"}
        </Button>
        <Button
          marginLeft={16}
          onClick={deleteDocument}
          disabled={!document.canDelete}
          intent="danger"
        >
          <Icons.delete size={18} />
        </Button>
      </Pane>
    </Pane>
  );
});

export default observer(DocumentLoadingContainer);
