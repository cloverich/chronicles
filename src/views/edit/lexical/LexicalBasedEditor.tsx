import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import type { EditorState, LexicalEditor } from "lexical";
import React from "react";
import { LexicalBlockShortcutsPlugin } from "./LexicalBlockShortcutsPlugin";
import { LexicalCheckListShortcutPlugin } from "./LexicalCheckListShortcutPlugin";
import { LexicalCodeHighlightPlugin } from "./LexicalCodeHighlightPlugin";
import { LexicalCodeLanguagePlugin } from "./LexicalCodeLanguagePlugin";
import { LexicalFormattingShortcutsPlugin } from "./LexicalFormattingShortcutsPlugin";
import { LexicalImageUploadPlugin } from "./LexicalImageUploadPlugin";
import { LexicalLinkToolbarPlugin } from "./LexicalLinkToolbarPlugin";
import { LexicalListBehaviorPlugin } from "./LexicalListBehaviorPlugin";
import { LexicalNoteLinkPlugin } from "./LexicalNoteLinkPlugin";
import { LexicalPasteLinkPlugin } from "./LexicalPasteLinkPlugin";
import {
  $exportMarkdownFromLexical,
  $loadMarkdownIntoLexical,
  chroniclesLexicalTransformers,
  lexicalNodes,
} from "./lexicalMarkdown";

interface MinimalReplacementEditorProps {
  initialMarkdown: string;
  onMarkdownChange: (markdown: string) => void;
  onEditorReady?: (editor: LexicalEditor) => void;
  documentId?: string;
}

function EditorReadyPlugin({
  onEditorReady,
}: Pick<MinimalReplacementEditorProps, "onEditorReady">): JSX.Element | null {
  const [editor] = useLexicalComposerContext();

  React.useEffect(() => {
    onEditorReady?.(editor);
  }, [editor, onEditorReady]);

  return null;
}

/**
 * Lexical based editor
 */
export function LexicalBasedEditor({
  initialMarkdown,
  onMarkdownChange,
  onEditorReady,
  documentId,
}: MinimalReplacementEditorProps): JSX.Element {
  const lastMarkdownRef = React.useRef(initialMarkdown);

  return (
    <div className="font-body relative flex w-full grow flex-col">
      <LexicalComposer
        initialConfig={{
          editable: true,
          editorState: () => {
            $loadMarkdownIntoLexical(initialMarkdown);
          },
          namespace: "chronicles-lexical-spike",
          nodes: lexicalNodes,
          onError(error) {
            throw error;
          },
          theme: {
            code: "group/code mb-8 max-w-[var(--max-w-code)] w-full block relative rounded-md bg-muted/60 p-8 pr-4 font-mono text-[length:var(--font-size-code)]",
            codeHighlight: {
              comment: "text-muted-foreground italic",
              function: "text-blue-600",
              keyword: "text-fuchsia-600",
              number: "text-orange-600",
              operator: "text-foreground/80",
              punctuation: "text-foreground/70",
              string: "text-emerald-700",
            },
            heading: {
              h1: "max-w-[var(--max-w-prose)] w-full text-[length:var(--font-size-heading)] font-semibold font-heading mt-[1.6em] mb-[0.5em]",
              h2: "max-w-[var(--max-w-prose)] w-full text-[length:calc(var(--font-size-heading)*0.833)] font-semibold font-heading-2 mt-[1.4em] mb-[0.5em]",
              h3: "max-w-[var(--max-w-prose)] w-full text-[length:calc(var(--font-size-heading)*0.75)] font-semibold font-heading-3 mt-[1em] mb-[0.5em]",
            },
            link: "text-link cursor-pointer underline decoration-1 underline-offset-1",
            list: {
              checklist: "list-none pl-2",
              listitem:
                "text-[length:var(--font-size-body)] [&:has(>ul):not(:has(>span))]:list-none",
              listitemChecked: "lexical-listitem-checked",
              listitemUnchecked: "lexical-listitem-unchecked",
              nested: {
                listitem: "",
              },
              ol: "max-w-[var(--max-w-prose)] w-full list-decimal pl-6 mb-8",
              ul: "max-w-[var(--max-w-prose)] w-full list-disc pl-6 mb-8",
            },
            paragraph: "mb-8 max-w-[var(--max-w-prose)] w-full",
            quote:
              "max-w-[var(--max-w-prose)] w-full border-l-2 border-border pl-4 italic text-muted-foreground mb-8",
            text: {
              bold: "font-semibold",
              code: "bg-muted rounded px-1 py-0.5 font-mono text-[length:var(--font-size-code)] text-foreground",
              italic: "italic",
              strikethrough: "line-through",
              underline: "underline",
            },
          },
        }}
      >
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              aria-label="Editor"
              className="min-h-[240px] w-full grow pb-12 text-[length:var(--font-size-body)] leading-7 focus:outline-hidden"
            />
          }
          placeholder={
            <div className="text-muted-foreground pointer-events-none absolute top-0 left-0">
              Start writing...
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <LinkPlugin />
        <ListPlugin />
        <CheckListPlugin />
        <MarkdownShortcutPlugin transformers={chroniclesLexicalTransformers} />
        <LexicalCodeHighlightPlugin />
        <LexicalCodeLanguagePlugin />
        <LexicalFormattingShortcutsPlugin />
        <LexicalBlockShortcutsPlugin />
        <LexicalListBehaviorPlugin />
        <LexicalCheckListShortcutPlugin />
        <LexicalImageUploadPlugin />
        <LexicalPasteLinkPlugin />
        <LexicalLinkToolbarPlugin />
        <OnChangePlugin
          ignoreSelectionChange
          onChange={(editorState: EditorState) => {
            const nextMarkdown = editorState.read(() =>
              $exportMarkdownFromLexical(),
            );

            if (nextMarkdown !== lastMarkdownRef.current) {
              lastMarkdownRef.current = nextMarkdown;
              onMarkdownChange(nextMarkdown);
            }
          }}
        />
        <EditorReadyPlugin onEditorReady={onEditorReady} />
        <LexicalNoteLinkPlugin documentId={documentId} />
      </LexicalComposer>
    </div>
  );
}
