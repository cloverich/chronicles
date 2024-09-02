import { TagInput } from "evergreen-ui";
import { observer } from "mobx-react-lite";
import React from "react";
import { SearchStore } from "../SearchStore";

interface Props {
  store: SearchStore;
}

/**
 * SearchDocuments is a component that provides a search input for searching documents.
 */
const SearchDocuments = (props: Props) => {
  function onRemove(tag: string | React.ReactNode, idx: number) {
    if (typeof tag !== "string") return;
    props.store.removeToken(tag);
  }

  function onAdd(tokens: string[]) {
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

    const token = tokens[0];
    props.store.addToken(token);
  }

  return (
    <TagInput
      className="drag-none"
      flexGrow={1}
      inputProps={{ placeholder: "Search journals" }}
      values={props.store.searchTokens}
      onAdd={onAdd}
      onRemove={onRemove}
    />
  );
};

export default observer(SearchDocuments);
