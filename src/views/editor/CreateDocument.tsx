import React from 'react';
import { observer } from 'mobx-react-lite';
import Editor from './editor';
import { Pane, Button, Alert, TextInputField, Select } from 'evergreen-ui';
import { useNewEditableDocument } from './useEditableDocument';



function CreateDocument() {
  const {
    setEditorValue,
    slateContent,
    journals,
    save,
    isDirty,
    loading,
    loadingErr,
    docState,
  } = useNewEditableDocument();

  function renderError() {
    if (!loadingErr) return null;
    
    return (
      <Alert 
        intent="danger" 
        title="Error loading document"
      >
        {JSON.stringify(loadingErr)}
      </Alert>
    )
  }

  const options = journals?.map((j: any) => {
    return (
      <option key={j.id} value={j.id} selected={docState?.journalId === j.id}>
        {j.name}
      </option>
    )
  })

  return (
    <Pane marginTop={24}>
      {renderError()}
      <Pane marginBottom={24}>

        <TextInputField
          name="title"
          placeholder="An optional title for this document"
          disabled={docState?.saving || loading}
          onChange={(e: any) => docState!.title = e.target.value}
          value={docState && docState.title || ''}
          />

        <Select onChange={e => docState!.journalId = e.target.value}>
          {options}
        </Select>
      </Pane>
      <Editor saving={docState?.saving || loading} value={slateContent} setValue={setEditorValue} />

      <Pane marginTop={24}>
        <Button onClick={save} disabled={!isDirty} isLoading={docState?.saving || loading}>Save</Button>
      </Pane>
    </Pane>
  )
}

export default observer(CreateDocument)