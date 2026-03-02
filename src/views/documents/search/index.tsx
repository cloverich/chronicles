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
      showToggle={true}
    />
  );
});

const searchTags = [
  { value: "in:", label: "Filter to specific journal" },
  { value: "tag:", label: "Filter to specific tag" },
  { value: "title:", label: "Filter by title" },
  { value: "text:", label: "Search body text" },
  { value: "before:", label: "Before date (YYYY-MM-DD)" },
  { value: "date:", label: "On date (YYYY-MM-DD)" },
];
