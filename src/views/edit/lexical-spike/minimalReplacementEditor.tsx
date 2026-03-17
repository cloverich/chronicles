import React from "react";

interface MinimalReplacementEditorProps {
  initialMarkdown: string;
  onMarkdownChange: (markdown: string) => void;
}

/**
 * Architecture spike: this component intentionally models the smallest contract
 * the edit screen needs from any editor runtime (Slate, Lexical, etc.):
 * markdown-in and markdown-out.
 */
export function MinimalReplacementEditor({
  initialMarkdown,
  onMarkdownChange,
}: MinimalReplacementEditorProps): JSX.Element {
  const [value, setValue] = React.useState(initialMarkdown);

  return (
    <label className="flex flex-col gap-2">
      <span className="text-muted-foreground text-sm">
        Minimal replacement editor (spike)
      </span>
      <textarea
        aria-label="Minimal replacement editor"
        className="border-border bg-background min-h-[180px] rounded-md border p-3 font-mono text-sm"
        value={value}
        onChange={(event) => {
          const next = event.target.value;
          setValue(next);
          onMarkdownChange(next);
        }}
      />
    </label>
  );
}
