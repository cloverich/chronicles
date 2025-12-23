import React from "react";

import { ClickableTag as Tag } from "../../../components/tag-input/TagInput";
import { useTagsWithCounts } from "../../../hooks/useTags";
import { Card } from "./Card";

/**
 * List of tags to search by.
 */
export function TagsList(props: { search: (tag: string) => boolean }) {
  const { loading, error, tags } = useTagsWithCounts();

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
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => {
          return (
            <Tag key={t.tag} onClick={() => props.search(t.tag)}>
              <span>{t.tag}</span>
              <span className="ml-0.5 text-xs opacity-60">({t.count})</span>
            </Tag>
          );
        })}
      </div>
    </Card>
  );
}
