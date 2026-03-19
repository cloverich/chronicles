import { $isCodeNode, getCodeLanguageOptions } from "@lexical/code";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getNodeByKey, $getSelection, $isRangeSelection } from "lexical";
import React from "react";
import { createPortal } from "react-dom";

interface CodeLanguageState {
  key: string;
  language: string;
}

interface CodeLanguagePosition {
  left: number;
  top: number;
}

const POPOVER_WIDTH_PX = 220;
const codeLanguageOptions = getCodeLanguageOptions();

function getCodeLanguageState(): CodeLanguageState | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
    return null;
  }

  const anchorNode = selection.anchor.getNode();
  const parent = anchorNode.getParent();
  const codeNode = $isCodeNode(anchorNode)
    ? anchorNode
    : $isCodeNode(parent)
      ? parent
      : null;

  if (!$isCodeNode(codeNode)) {
    return null;
  }

  return {
    key: codeNode.getKey(),
    language: codeNode.getLanguage() ?? "plain",
  };
}

function getLanguagePopoverPosition(
  codeElement: HTMLElement,
): CodeLanguagePosition {
  const bounds = codeElement.getBoundingClientRect();
  return {
    left: Math.max(8, bounds.right - POPOVER_WIDTH_PX - 8),
    top: Math.max(8, bounds.top + 6),
  };
}

export function LexicalCodeLanguagePlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [state, setState] = React.useState<CodeLanguageState | null>(null);
  const [position, setPosition] = React.useState<CodeLanguagePosition | null>(
    null,
  );

  React.useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      let next: CodeLanguageState | null = null;
      editorState.read(() => {
        next = getCodeLanguageState();
      });

      setState((current) => {
        if (
          current?.key === next?.key &&
          current?.language === next?.language
        ) {
          return current;
        }
        return next;
      });
    });
  }, [editor]);

  React.useEffect(() => {
    if (!state) {
      setPosition(null);
      return;
    }

    const syncPosition = () => {
      const codeElement = editor.getElementByKey(state.key);
      if (!(codeElement instanceof HTMLElement)) {
        setPosition(null);
        return;
      }

      setPosition(getLanguagePopoverPosition(codeElement));
    };

    syncPosition();
    window.addEventListener("resize", syncPosition);
    window.addEventListener("scroll", syncPosition, true);

    return () => {
      window.removeEventListener("resize", syncPosition);
      window.removeEventListener("scroll", syncPosition, true);
    };
  }, [editor, state]);

  if (!state || !position || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="bg-popover z-50 flex w-[220px] items-center gap-2 rounded-md border px-2 py-1 text-xs shadow-md"
      style={{
        left: `${position.left}px`,
        position: "fixed",
        top: `${position.top}px`,
      }}
      data-testid="lexical-code-language-picker"
    >
      <label
        className="text-muted-foreground shrink-0 text-xs"
        htmlFor="lexical-code-language"
      >
        Language
      </label>
      <select
        id="lexical-code-language"
        className="bg-popover ring-offset-background focus-visible:ring-ring flex h-6 min-w-0 grow rounded-md border px-1.5 text-xs focus-visible:ring-2 focus-visible:outline-none"
        aria-label="Code language"
        value={state.language || "plain"}
        onChange={(event) => {
          const selectedLanguage = event.target.value;
          editor.update(() => {
            const node = $getNodeByKey(state.key);
            if (!$isCodeNode(node)) {
              return;
            }

            node.setLanguage(
              selectedLanguage === "plain" ? undefined : selectedLanguage,
            );
          });
        }}
      >
        {codeLanguageOptions.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>,
    document.body,
  );
}
