import React from 'react';
import { EditableDocument } from "./EditableDocument";


interface Props {
    doc: EditableDocument
}

/**
 * Helper for viewing intermediate transformations of Slate's content
 */
export function DebugView({ doc }: Props) {
    return (
        <div >
            <details>
                <summary>Raw content</summary>
                <div>
                    <pre style={{ fontSize: "12px" }}>{doc.content}</pre>
                </div>
            </details>
            <details>
                <summary>Slate to Mdast</summary>
                <div>
                    <pre style={{ fontSize: "12px" }}>{JSON.stringify(doc.mdastDebug, null, 2)}</pre>
                </div>
            </details>
            <details>
                <summary>Slate content</summary>
                <div>
                    <pre style={{ fontSize: "12px" }}>{JSON.stringify(doc.slateContent, null, 2)}</pre>
                </div>
            </details>
        </div>
    )
}