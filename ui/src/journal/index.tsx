import React, { useState } from "react";
import { observer } from "mobx-react-lite";
import { Heading, Paragraph } from "evergreen-ui";
import { useJournals, useSearch } from "../hooks/journals";
import Document from "./document";
import Layout from "./layout";

interface EditingArgs {
  journal: string;
  date?: string;
}

function Journal() {
  const store = useJournals();
  const search = useSearch();

  const [editing, setEditing] = useState<EditingArgs | undefined>();

  // todo: i made parent container take care of watching for loading
  if (store.loading && !search.content) {
    return (
      <Layout editing={editing} setEditing={setEditing}>
        <Heading>Loading</Heading>
      </Layout>
    );
  }

  // todo: I didn't really implement error handling :|
  if (store.error) {
    return (
      <Layout editing={editing} setEditing={setEditing}>
        <Heading>Error</Heading>
        <Paragraph>{store.error.message}</Paragraph>
      </Layout>
    );
  }

  // empty states
  if (!search.content || !search.content.length) {
    if (store.journals.length) {
      return (
        <Layout editing={editing} setEditing={setEditing}>
          <Heading>No documents</Heading>
          <Paragraph>
            The selected journal has no documents yet. Add one.
          </Paragraph>
        </Layout>
      );
    } else {
      return (
        <Layout editing={editing} setEditing={setEditing}>
          <Heading>No journals added</Heading>
          <Paragraph>
            Use the config link in the navbar to create a new journal.
          </Paragraph>
        </Layout>
      );
    }
  }

  const docs = search.content
    .slice(0, 10)
    .map((item) => (
      <Document
        key={item.join("-")}
        journal={item[0]}
        date={item[1]}
        setEditing={setEditing}
      />
    ));

  return (
    <Layout editing={editing} setEditing={setEditing}>
      {docs}
    </Layout>
  );
}

export default observer(Journal);
