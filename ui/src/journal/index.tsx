import React, { useState } from "react";
import { Pane } from "evergreen-ui";
import { ContentState, JournalsState } from "../hooks";
import Document from "./document";
import Header from "./header";
import Search from "./search";

interface EditingArgs {
  journal: string;
  date?: string;
}

export default function Journal(
  props: ContentState & Pick<JournalsState, "journals">
) {
  const { loading, error, content, query, setQuery } = props;
  const [editing, setEditing] = useState<EditingArgs | undefined>();

  // TODO: Layout and ErrorLoading helpers
  // TODO: Call it: /canvas
  if (loading) return <h1>Loading</h1>;
  if (error)
    return (
      <Pane>
        <h1>Error</h1>
        <p>{error.message}</p>
      </Pane>
    );

  // Empty helpers too
  // todo: add document if journals != null
  // todo: if no journals direct user to config
  // todo: if journals but no query direct user to query
  if (!content) {
    return (
      <Pane>
        <Search {...props} />
        <h1>Missing content</h1>
        <p>A content placeholder sure would be nice!</p>
      </Pane>
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
    <Pane margin={50}>
      <Search {...props} />
      <Header {...props} editing={editing} setEditing={setEditing} />
      {docs}
    </Pane>
  );
}
