import { TagInput } from "evergreen-ui";
import React from "react";

export function TagSearchLoading() {
  return (
    <TagInput
      flexGrow={1}
      inputProps={{ placeholder: "Search journals" }}
      disabled
    />
  );
}
