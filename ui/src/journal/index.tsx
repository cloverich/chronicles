import React, { useState } from "react";
import { Pane, Heading, Paragraph } from "evergreen-ui";
import { ContentState, JournalsState } from "../hooks";
import Document from "./document";
import Layout from "./layout";

interface EditingArgs {
  journal: string;
  date?: string;
}

export default function Journal(
  props: ContentState & Pick<JournalsState, "journals">
) {
  const { loading, error, content, query, setQuery } = props;
  const [editing, setEditing] = useState<EditingArgs | undefined>();

  if (loading && !content) {
    return (
      <Layout {...props} {...{ editing, setEditing }}>
        <Heading>Loading</Heading>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout {...props} {...{ editing, setEditing }}>
        <Heading>Error</Heading>
        <Paragraph>{error.message}</Paragraph>
      </Layout>
    );
  }

  // Empty helpers too
  // todo: add document if journals != null
  // todo: if no journals direct user to config
  // todo: if journals but no query direct user to query
  if (!content) {
    return (
      <Layout {...props} {...{ editing, setEditing }}>
        <Heading>Missing content</Heading>
        <Paragraph>A content Paragraphlaceholder sure would be nice!</Paragraph>
      </Layout>
    );
  }

  const docs = content.docs
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
    <Layout {...props} {...{ editing, setEditing }}>
      {docs}
    </Layout>
  );
}
