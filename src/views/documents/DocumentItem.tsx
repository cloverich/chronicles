import React from "react";
import { ClickableTag } from "../../components/TagInput";
import { SearchItem, useSearchStore } from "./SearchStore";

export function DocumentItem(props: {
  doc: SearchItem;
  edit: (id: string) => any;
}) {
  const { doc, edit } = props;
  const search = useSearchStore()!;

  return (
    <div key={doc.id} className="flex items-center">
      {/* Without mono font, dates won't be a uniform width */}
      <div className="mr-6 shrink-0 font-mono text-sm tracking-tight">
        {doc.createdAt.slice(0, 10)}
      </div>
      <div
        className="hover:underline-offset mr-2 cursor-pointer font-sans hover:underline"
        onClick={() => edit(doc.id)}
      >
        {doc.title || "Untitled"}
      </div>
      <ClickableTag
        size="xs"
        variant="muted"
        onClick={() => search.addToken(`in:${doc.journal}`)}
      >
        in:{doc.journal}
      </ClickableTag>
    </div>
  );
}
