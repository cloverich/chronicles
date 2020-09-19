import React from "react";
import {
  SideSheet,
  Paragraph,
  Card,
  Pane,
  Heading,
  Button,
} from "evergreen-ui";
import { observer } from "mobx-react-lite";
import { IJournalsUiStore } from "../../store";

interface Props {
  store: IJournalsUiStore;
}

function JournalSidebar(props: Props) {
  const store = props.store;
  // store.journals

  const select = (journal: string) => {
    store.selectJournal(journal);
    store.sidebarOpen = false;
  };

  const journals = store.journals.map((journal) => {
    return (
      <Button
        key={journal.url}
        appearance="minimal"
        onClick={() => select(journal.name)}
      >
        {journal.name}
      </Button>
    );
  });

  return (
    <React.Fragment>
      <SideSheet
        isShown={store.sidebarOpen}
        onCloseComplete={() => (store.sidebarOpen = false)}
        containerProps={{
          display: "flex",
          flex: "1",
          flexDirection: "column",
        }}
      >
        <Pane zIndex={1} flexShrink={0} elevation={0} backgroundColor="white">
          <Pane padding={16}>
            <Heading size={600}>Saved searches</Heading>
            <Paragraph size={400}>
              Quick links for saved searches. Currently only supports searching
              for journals
            </Paragraph>
          </Pane>
        </Pane>
        <Pane flex="1" overflowY="scroll" background="tint1" padding={16}>
          <Card backgroundColor="white" elevation={0} height={240} padding={24}>
            <Heading>Journals</Heading>
            <Pane display="flex" flexDirection="column">
              {journals}
            </Pane>
          </Card>
        </Pane>
      </SideSheet>
    </React.Fragment>
  );
}

export default observer(JournalSidebar);
