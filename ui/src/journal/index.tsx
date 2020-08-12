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

  // Empty helpers too
  // todo: add document if journals != null
  // todo: if no journals direct user to config
  // todo: if journals but no query direct user to query
  if (!search.content) {
    return (
      <Layout editing={editing} setEditing={setEditing}>
        <Heading>Missing content</Heading>
        <Paragraph>A content Paragraphlaceholder sure would be nice!</Paragraph>
      </Layout>
    );
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
