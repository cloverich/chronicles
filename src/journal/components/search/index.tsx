import React from "react";
import { TagInput } from "evergreen-ui";
import { observer, useLocalStore } from "mobx-react-lite";
import { IJournalsUiStore } from "../../store";
import { TagSearchStore } from "./store";
import { TagSearchLoading } from './loading';

interface Props {
  store: Pick<IJournalsUiStore, "tokens">;
}

export default function TagSearchContainer(props: Partial<Props>) {
  if (!props.store) {
    return <TagSearchLoading />
  }

  return <ObvsTagSearch store={props.store} />
}

function TagSearch(props: Props) {
  const store = useLocalStore(() => {
    return new TagSearchStore(props.store);
  });

  function onRemove(tag: string | React.ReactNode, idx: number) {
    if (typeof tag !== "string") return;
    store.removeToken(tag);
  }

  function onAdd(tokens: string[]) {
    if (tokens.length > 1) {
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
    store.addToken(token);
  }

  return (
    <TagInput
      flexGrow={1}
      inputProps={{ placeholder: "Search journals" }}
      values={store.searchTokens}
      onAdd={onAdd}
      onRemove={onRemove}
    />
  );
}

const ObvsTagSearch = observer(TagSearch);
