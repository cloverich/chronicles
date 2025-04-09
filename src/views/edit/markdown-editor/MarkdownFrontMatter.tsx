import { observer } from "mobx-react-lite";
import React from "react";
import { JournalResponse } from "../../../hooks/useClient";
import { EditableDocument } from "../EditableDocument";

/**
 * Displays the document's front matter in a read-only format.
 * This is used in the markdown editor to show the document's metadata.
 */
export const MarkdownFrontMatter = observer(
  ({
    document,
    journals,
  }: {
    document: EditableDocument;
    journals: JournalResponse[];
  }) => {
    // Find the journal name
    function getName(journalName?: string) {
      const journal = journals?.find((j) => j.name === journalName);
      return journal ? journal.name : "Unknown journal";
    }

    return (
      <div className="mb-6 rounded-sm border border-gray-200 bg-gray-50 p-4">
        <h2 className="mb-2 font-medium">Document Metadata</h2>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="font-mono font-medium">Title:</span>{" "}
            {document.title || "Untitled"}
          </div>
          <div>
            <span className="font-mono font-medium">Journal:</span>{" "}
            {getName(document.journal)}
          </div>
          <div>
            <span className="font-mono font-medium">Created:</span>{" "}
            {document.createdAt.slice(0, 10)}
          </div>
          <div>
            <span className="font-mono font-medium">Updated:</span>{" "}
            {document.updatedAt.slice(0, 10)}
          </div>
          <div>
            <span className="font-mono font-medium">ID:</span> {document.id}
          </div>
          <div>
            <span className="font-mono font-medium">Tags:</span>{" "}
            {document.tags.length > 0 ? document.tags.join(", ") : "No tags"}
          </div>
        </div>
      </div>
    );
  },
);
