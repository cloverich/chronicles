import React from "react";

import { ClickableTag as Tag } from "../../../components/tag-input/TagInput";
import { useTags } from "../../../hooks/useTags";
import { Card } from "./Card";

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

  return (
    <Card>
      <div className="text-md mb-2 flex cursor-pointer items-center font-medium tracking-tight">
        Tags
      </div>
      <div className="flex flex-wrap">
        {tags.map((t) => {
          return (
            <Tag className="mb-1 mr-1" key={t} onClick={() => props.search(t)}>
              #{t}
            </Tag>
          );
        })}
      </div>
    </Card>
  );
}
