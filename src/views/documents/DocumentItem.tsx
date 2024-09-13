import React from "react";
import { ClickableTag } from "../../components/TagInput";
import { SearchItem, useSearchStore } from "./SearchStore";

export function DocumentItem(props: {
  doc: SearchItem;
  edit: (id: string) => any;
  getName: (id: string) => string;
}) {
  const { doc, edit, getName } = props;
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
        {doc.title}
      </div>
      <ClickableTag
        size="xs"
        variant="muted"
        onClick={() => search.addToken(`in:${getName(doc.journalId)}`)}
      >
        in:{getName(doc.journalId)}
      </ClickableTag>
    </div>
  );
}
