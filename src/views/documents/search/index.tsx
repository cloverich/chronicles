import { observer } from "mobx-react-lite";
import React from "react";
import TagInput from "../../../components/tag-input/TagInput";
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
      suggestions={searchTags}
      openOnEmptyFocus={true}
      searchOnSelect={false}
    />
  );
});

const searchTags = [
  { value: "in:", label: "Filter to specific journal" },
  { value: "tag:", label: "Filter to specific tag" },
  { value: "title:", label: "Filter by title" },
  { value: "text:", label: "Search body text" },
  { value: "before:", label: "Filter to notes before date (YYYY-MM-DD)" },
];
