import { Badge } from "evergreen-ui";
import React from "react";
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
      className="hover:underline-offset flex cursor-pointer hover:underline"
    >
      {/* Without mono font, dates won't be a uniform width */}
      <div className="mr-6 shrink-0 font-mono text-sm tracking-tight">
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
