import React from "react";
import { Pane, Badge } from "evergreen-ui";
import { SearchItem } from "./SearchStore";

export function DocumentItem(props: {
  doc: SearchItem;
  edit: (id: string) => any;
  getName: (id: string) => string;
}) {
  const { doc, edit, getName } = props;

  return (
    <div
      key={doc.id}
      onClick={() => edit(doc.id)}
      className="cursor-pointer flex hover:underline hover:underline-offset"
    >
      {/* Without mono font, dates won't be a uniform width */}
      <div className="font-mono text-sm tracking-tight mr-6 shrink-0">
        {doc.createdAt.slice(0, 10)}
      </div>
      <div className="font-sans">
        {doc.title}
        <small>
          <Badge
            color="purple"
            fontWeight={400}
            textTransform="none"
            marginLeft={8}
          >
            {getName(doc.journalId)}
          </Badge>
        </small>
      </div>
    </div>
  );
}
