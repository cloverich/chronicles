import React from "react";
import { TagInput } from "evergreen-ui";
import { observer, useLocalStore } from "mobx-react-lite";
import { TagSearchStore, ITokensStore } from "./store";
import { useSearchParams } from 'react-router-dom';

interface Props {
  store: ITokensStore;
}

export default observer(function TagSearch(props: Props) {
  const store = useLocalStore(() => {
    return new TagSearchStore(props.store);
  });

  const [params, setParams] = useSearchParams();

  // Restore search from URL params on mount
  // NOTE: If user (can) manipulate URL, or once saved
  // searches are implemented, this will need to be extended
  React.useEffect(() => {
    const tokens = params.getAll('search');
    for (const token of tokens) {
      store.addToken(token);
    }
  }, [])

  function onRemove(tag: string | React.ReactNode, idx: number) {
    if (typeof tag !== "string") return;
    store.removeToken(tag);
    setParams({ search: store.searchTokens }, { replace: true });
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
    store.addToken(token);
    setParams({ search: store.searchTokens }, { replace: true });
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
})
