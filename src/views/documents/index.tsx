import React, { useEffect, useContext }  from "react";
// todo: feels a bit like this should be provided via context
import client, { Client} from "../../client";
import { SearchResponse } from '../../api/client/documents';
import { observable } from 'mobx';
import { observer } from 'mobx-react-lite';
import { Heading, Paragraph, Pane, Button } from "evergreen-ui";
import { useJournals } from '../../useJournals';

class SearchV2Store {
  constructor(private client: Client) {}

  @observable docs: SearchResponse["data"] = [];
  @observable loading = true;
  @observable error: string | null = null;

  search = async () => {
    this.loading = true;
    this.error = null;
    try {
      const res = this.client.v2.documents.search()
      this.docs = (await res).data;
    } catch (err) {
      this.error = JSON.stringify(err);
    }

    this.loading = false;
  }
}

export const SearchV2Context = React.createContext<SearchV2Store>(new SearchV2Store(client));


import { ViewState } from '../../container';

interface Props extends React.PropsWithChildren<{}> {
  setView: React.Dispatch<React.SetStateAction<ViewState>>
}


// The old Layout had the modal and some other stuff
function Layout(props: Partial<Props>) {
  return (
    <Pane>
      <a onClick={props.setView ? () => props.setView!({ name: 'edit', props: {}}): () => {}}>
        Create new
      </a>
      <Pane marginTop={24}>
        {props.children}
      </Pane>
    </Pane>
  )
}


function DocumentsContainer(props: Props) {
  const searchV2Store = useContext(SearchV2Context);
  const {
    loadingErr: loadingJournalsErr,
    loading: loadingJournals,
    journals
  } = useJournals();

  function edit(docId: string) {
    props.setView({name: 'edit', props: { documentId: docId}})
  }

  // execute search on mount
  useEffect(() => {
    searchV2Store.search()
  }, [])

  // loading states
  if (loadingJournals || searchV2Store.loading && !searchV2Store.docs.length) {
    return (
      <Layout>
        <Heading>Loading</Heading>
      </Layout>
    );
  }

  // todo: I didn't really implement error handling :|
  if (loadingJournalsErr || searchV2Store.error) {
    return (
      <Layout>
        <Heading>Error</Heading>
        <Paragraph>{JSON.stringify(loadingJournalsErr || searchV2Store.error)}</Paragraph>
      </Layout>
    );
  }

  // empty states
  if (!searchV2Store.docs.length) {
    if (journals!.length) {
      return (
        <Layout>
          <Heading>No documents found</Heading>
          <Paragraph>Broaden your search, or add more documents.</Paragraph>
        </Layout>
      );
    } else {
      return (
        <Layout>
          <Heading>No journals added</Heading>
          <Paragraph>
            Use the config link in the navbar to create a new journal.
          </Paragraph>
        </Layout>
      );
    }
  }

  function getName(id: string) {
    const jrnl = journals?.find(j => j.id === id);
    if (!jrnl) return "shrug"

    return jrnl.name;
  }

  const docs = searchV2Store.docs.map(doc => {
    return (
    <Pane key={doc.id} style={{display: 'flex',}} onClick={() => edit(doc.id)}>
      <div style={{marginRight: '24px'}}>{doc.createdAt.slice(0,10)}</div>
      <div>/{getName(doc.journalId)}/{doc.title}</div>
    </Pane>
    )
  })


  return (
    <Layout setView={props.setView}>
      {docs}
    </Layout>
  )
}

export default observer(DocumentsContainer);