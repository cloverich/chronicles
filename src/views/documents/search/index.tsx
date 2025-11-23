import { observer } from "mobx-react-lite";
import React from "react";
import TagInput from "../../../components/TagInput";
import { useSearchStore } from "../SearchStore";

export const SearchInput = observer(() => {
  const searchStore = useSearchStore()!;

  return (
    <TagInput
      hotkey="mod+f"
      tokens={searchStore.searchTokens}
      onAdd={(token) => searchStore.addToken(token)}
      onRemove={(token) => searchStore.removeToken(token)}
      placeholder="Search notes"
      dropdownEnabled={true}
    />
  );
});
