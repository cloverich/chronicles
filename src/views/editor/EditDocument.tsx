import React from 'react';
import { observer } from 'mobx-react-lite';
import Editor from '../../journal/components/editor/editor';
import { Pane, Button, Alert, TextInputField } from 'evergreen-ui';
import { useEditableDocument } from './useEditableDocument';
import { useJournals } from '../../useJournals';

interface Props {
  documentId: string;
}

function EditDocument(props: Props) {
  const {
    setEditorValue,
    slateContent,
    save,
    isDirty,
    loading: loadingDoc,
    loadingErr: loadingDocErr,
    docState,
  } = useEditableDocument(props.documentId);

  const { journals, loading: loadingJournals, loadingErr: loadingJournalsErr } = useJournals()
  const loading = loadingDoc || loadingJournals
  const loadingErr = loadingDocErr || loadingJournalsErr

  function renderError() {
    if (!loadingErr) return null;
    
    return (
      <Alert 
        intent="danger" 
        title="Error saving journal"
      >
        {JSON.stringify(loadingErr)}
      </Alert>
    )
  }

  function getName(journalId?: string) {
    const journal = journals?.find(j => j.id === journalId)
    return journal ? journal.name : 'Unknown journal';
  }

  return (
    <Pane marginTop={24}>
      {renderError()}

      <TextInputField
        name="title"
        label="" // seems to require empty string to be null and hidden
        placeholder="An optional title for this document"
        disabled={docState?.saving || loading}
        onChange={(e: any) => docState!.title = e.target.value}
        value={docState && docState.title || ''}
        />
      <p style={{fontSize: '0.8rem', fontWeight: 'bold'}}>/{getName(docState?.journalId)}</p>
      <Editor saving={docState?.saving || loading} value={slateContent} setValue={setEditorValue} />
      <Button onClick={save} disabled={!isDirty} isLoading={docState?.saving || loading}>Save</Button>
    </Pane>
  )
}

export default observer(EditDocument)