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
import { LexicalCodeHighlightPlugin } from "./LexicalCodeHighlightPlugin";
import { LexicalCodeLanguagePlugin } from "./LexicalCodeLanguagePlugin";
import { LexicalFormattingShortcutsPlugin } from "./LexicalFormattingShortcutsPlugin";
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
}: MinimalReplacementEditorProps): JSX.Element {
  const lastMarkdownRef = React.useRef(initialMarkdown);

  return (
    <div className="relative flex w-full grow flex-col">
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
            code: "mb-3 block rounded-md bg-muted/60 px-4 pt-8 pb-3 font-mono text-[0.9em]",
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
              h1: "text-3xl font-semibold",
              h2: "text-2xl font-semibold",
              h3: "text-xl font-semibold",
            },
            link: "text-link cursor-pointer underline decoration-1 underline-offset-1",
            list: {
              checklist: "list-none pl-2",
              listitem: "[&:has(>ul):not(:has(>span))]:list-none",
              listitemChecked:
                "relative ml-7 list-none before:absolute before:top-0 before:left-[-1.75rem] before:text-xs before:text-muted-foreground before:content-['[x]']",
              listitemUnchecked:
                "relative ml-7 list-none before:absolute before:top-0 before:left-[-1.75rem] before:text-xs before:text-muted-foreground before:content-['[ ]']",
              nested: {
                listitem: "",
              },
              ol: "list-decimal pl-6",
              ul: "list-disc pl-6",
            },
            paragraph: "mb-3",
            quote: "border-l-2 border-border pl-4 italic text-muted-foreground",
            text: {
              bold: "font-semibold",
              code: "bg-muted rounded px-1 py-0.5 font-mono text-[0.9em] text-foreground",
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
              aria-label="Minimal replacement editor"
              className="min-h-[240px] w-full grow px-6 pb-12 text-base leading-7 focus:outline-hidden"
            />
          }
          placeholder={
            <div className="text-muted-foreground pointer-events-none absolute top-0 left-6">
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
        <LexicalNoteLinkPlugin />
      </LexicalComposer>
    </div>
  );
}
