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
      <div className="mono" style={{ flexShrink: 0, marginRight: "24px" }}>
        {doc.createdAt.slice(0, 10)}
      </div>
      <div>
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
