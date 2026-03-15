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
    <div key={doc.id} className="flex items-center justify-between space-y-0.5">
      <div className="flex items-center truncate">
        <div
          className="hover:text-interactive-hover mr-2 min-w-0 cursor-pointer truncate"
          style={{
            fontSize: "var(--font-size-search)",
            fontFamily: "var(--font-search-body)",
          }}
          onClick={() => edit(doc.id)}
        >
          {doc.title || "Untitled"}
        </div>
        <div className="text-muted-foreground mr-2 shrink-0 text-xs">
          {shortDate}
        </div>
      </div>
      <div
        role="button"
        tabIndex={0}
        className="text-muted-foreground hover:text-interactive-hover mr-2 shrink-0 cursor-pointer text-xs"
        onClick={() => search.addToken(`in:${doc.journal}`)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            search.addToken(`in:${doc.journal}`);
          }
        }}
      >
        /{doc.journal.toUpperCase()}
      </div>
    </div>
  );
}
