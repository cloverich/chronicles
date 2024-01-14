import React from "react";
import { TagInput } from "evergreen-ui";
import { observer } from "mobx-react-lite";
import { SearchV2Store } from "../SearchStore";

interface Props {
  store: SearchV2Store;
}

const TagSearch = (props: Props) => {

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
        "ignoring extra tokens"
      );
    }

    const token = tokens[0];
    props.store.addToken(token);
  }

  return (
    <TagInput
      flexGrow={1}
      inputProps={{ placeholder: "Search journals" }}
      values={props.store.searchTokens}
      onAdd={onAdd}
      onRemove={onRemove}
    />
  );
}

export default observer(TagSearch);
