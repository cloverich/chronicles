import React from "react";
import { SearchItem, useSearchStore } from "./SearchStore";

/**
 * Displays a document in the search results.
 */
export function DocumentItem(props: {
  doc: SearchItem;
  edit: (id: string) => any;
}) {
  const { doc, edit } = props;
  const search = useSearchStore()!;

  const docDate = new Date(doc.createdAt);
  const shortDate = docDate.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
  });

  return (
    <div key={doc.id} className="flex items-center justify-between">
      <div className="flex items-center truncate">
        <div
          className="mr-2 min-w-0 cursor-pointer truncate font-sans decoration-1 hover:underline hover:underline-offset-4"
          onClick={() => edit(doc.id)}
        >
          {doc.title || "Untitled"}
        </div>
        <div className="mr-2 shrink-0 text-xs text-muted-foreground">
          {shortDate}
        </div>
      </div>
      <div
        className="mr-2 shrink-0 cursor-pointer text-xs text-muted-foreground"
        onClick={() => search.addToken(`in:${doc.journal}`)}
      >
        /{doc.journal.toUpperCase()}
      </div>
    </div>
  );
}
