import React, { useState } from "react";
import { observer } from "mobx-react-lite";
import { Heading, Paragraph } from "evergreen-ui";
import Document from "./document/document";
import Layout from "./layout";
import { useViewModel } from "./useViewModel";
import PinnedHeading from "./pinnedheading";

function Journal() {
  const { journals, search, store } = useViewModel();

  if (journals.loading && !search.content) {
    return (
      <Layout store={store}>
        <Heading>Loading</Heading>
      </Layout>
    );
  }

  // todo: I didn't really implement error handling :|
  if (journals.error) {
    return (
      <Layout store={store}>
        <Heading>Error</Heading>
        <Paragraph>{journals.error.message}</Paragraph>
      </Layout>
    );
  }

  // empty states
  if (!search.content || !search.content.length) {
    if (journals.journals.length) {
      return (
        <Layout store={store}>
          <Heading>No documents</Heading>
          <Paragraph>
            The selected journal has no documents yet. Add one.
          </Paragraph>
        </Layout>
      );
    } else {
      return (
        <Layout store={store}>
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
        store={store}
      />
    ));

  const heaading = store.filter?.content ? (
    <PinnedHeading
      content={store.filter.content}
      clearHeading={() => store.setFilter(undefined)}
    />
  ) : null;

  return (
    <Layout store={store}>
      {heaading}
      {docs}
    </Layout>
  );
}

export default observer(Journal);
