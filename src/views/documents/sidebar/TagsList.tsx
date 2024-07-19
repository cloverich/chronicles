import React from "react";
import {
  ListItem,
  FolderCloseIcon,
  Card,
  Heading,
  UnorderedList,
} from "evergreen-ui";

import { useTags } from "../../../hooks/useTags";

/**
 * List of tags to search by.
 */
export function TagsList(props: { search: (tag: string) => boolean }) {
  const { loading, error, tags } = useTags();

  if (loading) {
    return "loading...";
  }

  if (error) {
    console.error("error loading tags", error);
    return "error loading tags";
  }

  const tagItems = tags.map((t) => {
    return (
      <ListItem key={t} icon={FolderCloseIcon}>
        <a href="" onClick={() => props.search(t)}>
          {t}
        </a>
      </ListItem>
    );
  });

  return (
    <Card backgroundColor="white" elevation={0} padding={16} marginBottom={16}>
      <Heading>Tags</Heading>
      <UnorderedList>{tagItems}</UnorderedList>
    </Card>
  );
}
