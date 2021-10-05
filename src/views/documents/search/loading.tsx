import React from "react";
import { TagInput } from "evergreen-ui";

export function TagSearchLoading() {
  return (
    <TagInput
      flexGrow={1}
      inputProps={{ placeholder: "Search journals" }}
      disabled
    />
  );
}

