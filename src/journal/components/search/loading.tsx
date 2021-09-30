import React from "react";
import { TagInput } from "evergreen-ui";
import { IJournalsUiStore } from "../../store";

interface Props {
  store?: Pick<IJournalsUiStore, "tokens">;
}

export function TagSearchLoading(props: Props) {
  return (
    <TagInput
      flexGrow={1}
      inputProps={{ placeholder: "Search journals" }}
      disabled
    />
  );
}

